// /api/polish-entity — gap-fill on ONE wiki entity using fresh source.
//
// Input:  { entityType, entity, gaps[], pdfBase64?, text?, homepageSlug, siblingSlugs[] }
// Output: { patch, evidence, unfilled, meta }
//
// Surgical alternative to /api/parse: instead of re-parsing the whole
// résumé (which would risk overwriting the user's manual edits to OTHER
// entities), this endpoint takes a single entity + a list of fields it
// claims are gaps, plus a fresh source document, and emits a patch
// covering only those gaps.
//
// Anti-hallucination: every emitted patch field MUST come with an
// `evidence` quote that is a literal substring of the source. Server
// validates and STRIPS any patch field whose evidence doesn't match —
// the model can't get a fabricated field past us no matter what its
// natural tendency is.

import Anthropic from "@anthropic-ai/sdk";
import {
  MODEL_ID,
  POLISH_SYSTEM_PROMPT,
  POLISH_ENTITY_TOOL,
  buildPolishUserMessage,
} from "../../yourpedia/lib/llm-config";
import { checkRateLimit } from "../../../lib/ratelimit";
import { getSupabaseServerClient } from "../../../lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

// Rate limit shared with /api/parse — anon 3/day, auth 10/day. Polish 不
// 单独算配额（vs 旧 30/day 独立）—— 简化为单一配额池，prevent abuse vector
// where attacker hits /polish-entity to bypass /parse limit.

async function extractPdfText(base64) {
  const pdfParse = (await import("pdf-parse")).default;
  const buf = Buffer.from(base64, "base64");
  if (buf.length > 5 * 1024 * 1024) {
    throw new Error("PDF too large (max 5 MB).");
  }
  const result = await pdfParse(buf);
  return (result.text || "").trim();
}

const ALLOWED_ENTITY_TYPES = new Set([
  "shipped",
  "educations",
  "experiences",
]);

const ALLOWED_GAP_FIELDS = new Set([
  "name_zh",
  "description",
  "description_zh",
  "role",
  "role_zh",
  "degree",
  "degree_zh",
  "date_range",
  "location",
  "url",
  "tech_stack",
  "body",
  "body_zh",
]);

// Substring match — evidence must literally appear in the source.
// Normalize whitespace on both sides because LLMs sometimes collapse
// internal newlines/double-spaces in their quotes.
function normalizeForMatch(s) {
  return String(s ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function evidenceSupports(source, evidence) {
  if (!evidence || typeof evidence !== "string") return false;
  if (evidence.trim().length < 10) return false;
  const haySack = normalizeForMatch(source);
  const needle = normalizeForMatch(evidence);
  if (!needle) return false;
  return haySack.includes(needle);
}

export async function POST(req) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "Server is missing ANTHROPIC_API_KEY." },
      { status: 500 }
    );
  }

  // 共用配额池（anon 3/day, auth 10/day）— 跟 /api/parse 同一个，防止
  // 攻击者用 /polish-entity 绕过 /parse 限制。
  let userId = null;
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id || null;
  } catch {}
  const rate = await checkRateLimit(req, userId);
  if (!rate.ok) {
    const reason = rate.requireAuth
      ? `免登录用户今日 AI 额度已用完（${rate.limit ?? 3} 次/天）。登录后可解锁 10 次/天。`
      : `今日 AI 额度已用完（${rate.limit ?? 10} 次/天）。明早重置，可以手动编辑该字段。`;
    return Response.json(
      { error: reason, requireAuth: !!rate.requireAuth, remaining: 0, resetAt: rate.reset },
      { status: 429, headers: rate.reset ? { "Retry-After": String(Math.max(1, Math.ceil((rate.reset - Date.now()) / 1000))) } : {} }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const {
    entityType,
    entity,
    gaps,
    pdfBase64,
    text,
    homepageSlug,
    siblingSlugs,
  } = body || {};

  if (!ALLOWED_ENTITY_TYPES.has(entityType)) {
    return Response.json(
      { error: `Invalid entityType "${entityType}".` },
      { status: 400 }
    );
  }
  if (!entity || typeof entity !== "object") {
    return Response.json({ error: "Missing entity." }, { status: 400 });
  }
  if (!Array.isArray(gaps) || gaps.length === 0) {
    return Response.json(
      { error: "gaps[] must be a non-empty array of field names." },
      { status: 400 }
    );
  }
  // Filter / sanitize the requested gaps server-side. Don't trust the
  // client to ask for arbitrary fields.
  const cleanGaps = gaps.filter(
    (g) => typeof g === "string" && ALLOWED_GAP_FIELDS.has(g)
  );
  if (cleanGaps.length === 0) {
    return Response.json(
      { error: "No valid gap fields requested." },
      { status: 400 }
    );
  }
  if (!pdfBase64 && !text) {
    return Response.json(
      { error: "Provide either `pdfBase64` or `text`." },
      { status: 400 }
    );
  }

  let sourceText = "";
  try {
    if (pdfBase64) sourceText = await extractPdfText(pdfBase64);
    if (text) {
      sourceText = sourceText
        ? sourceText + "\n\n--- Additional notes ---\n\n" + text
        : text;
    }
  } catch (e) {
    return Response.json(
      { error: `PDF parse failed: ${e.message}` },
      { status: 400 }
    );
  }
  if (sourceText.trim().length < 30) {
    return Response.json(
      {
        error:
          "Source text is too short to extract anything meaningful (need at least ~30 characters).",
      },
      { status: 400 }
    );
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let response;
  try {
    response = await anthropic.messages.create({
      model: MODEL_ID,
      max_tokens: 2500, // single-entity patch — much smaller than parse
      system: [
        {
          type: "text",
          text: POLISH_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [POLISH_ENTITY_TOOL],
      tool_choice: { type: "tool", name: POLISH_ENTITY_TOOL.name },
      messages: [
        {
          role: "user",
          content: buildPolishUserMessage({
            entityType,
            entity,
            gaps: cleanGaps,
            homepageSlug: homepageSlug || "",
            siblingSlugs: Array.isArray(siblingSlugs) ? siblingSlugs : [],
            source: sourceText,
          }),
        },
      ],
    });
  } catch (e) {
    return Response.json(
      { error: `LLM call failed: ${e.message || "unknown"}` },
      { status: e?.status || 500 }
    );
  }

  const toolBlock = (response.content || []).find(
    (b) => b.type === "tool_use" && b.name === POLISH_ENTITY_TOOL.name
  );
  if (!toolBlock || !toolBlock.input) {
    return Response.json(
      { error: "Model did not return a patch. Try a different source." },
      { status: 502 }
    );
  }

  const rawPatch = toolBlock.input.patch || {};
  const rawEvidence = toolBlock.input.evidence || {};
  const unfilled = Array.isArray(toolBlock.input.unfilled)
    ? toolBlock.input.unfilled
    : [];

  // Server-side guard pass:
  //  1. Drop any patch field NOT in the requested gaps (model overreach).
  //  2. Drop any patch field whose evidence is missing or doesn't
  //     substring-match the source. Add it to `rejected[]` so the
  //     client can tell the user "couldn't find evidence for X".
  const verifiedPatch = {};
  const verifiedEvidence = {};
  const rejected = [];
  for (const [field, value] of Object.entries(rawPatch)) {
    if (!ALLOWED_GAP_FIELDS.has(field)) continue;
    if (!cleanGaps.includes(field)) continue;
    // Empty-ish values are ignored (model returning "" instead of omitting).
    const isEmpty =
      value === "" ||
      value === null ||
      value === undefined ||
      (Array.isArray(value) && value.length === 0);
    if (isEmpty) continue;

    const ev = rawEvidence[field];
    if (!evidenceSupports(sourceText, ev)) {
      rejected.push({
        field,
        reason: ev
          ? "evidence quote does not appear in source"
          : "no evidence provided",
      });
      continue;
    }
    verifiedPatch[field] = value;
    verifiedEvidence[field] = ev;
  }

  // Anything in cleanGaps that wasn't filled OR was rejected ends up in
  // `unfilledFinal` for the client to surface to the user.
  const filledKeys = new Set(Object.keys(verifiedPatch));
  const unfilledFinal = cleanGaps.filter((g) => !filledKeys.has(g));

  const usage = response.usage || {};
  const inputTokens =
    (usage.input_tokens || 0) +
    (usage.cache_creation_input_tokens || 0) +
    (usage.cache_read_input_tokens || 0);
  const outputTokens = usage.output_tokens || 0;
  const estCostUsd =
    (inputTokens * 1) / 1_000_000 + (outputTokens * 5) / 1_000_000;

  return Response.json(
    {
      patch: verifiedPatch,
      evidence: verifiedEvidence,
      unfilled: Array.from(new Set([...unfilled, ...unfilledFinal])),
      rejected,
      meta: {
        model: MODEL_ID,
        sourceTextChars: sourceText.length,
        inputTokens,
        outputTokens,
        estCostUsd: Number(estCostUsd.toFixed(5)),
        rateLimitRemaining: rate.remaining,
      },
    },
    { status: 200 }
  );
}
