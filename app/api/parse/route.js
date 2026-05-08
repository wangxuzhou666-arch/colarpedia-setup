// /api/parse — accepts { pdfBase64?, text? }, returns structured wiki
// data via Claude Haiku 4.5 tool use.
//
// Server-only: reads ANTHROPIC_API_KEY from process.env. Never bundled
// into the client because route.js files don't ship to the browser.

import Anthropic from "@anthropic-ai/sdk";
import {
  MODEL_ID,
  MAX_TOKENS,
  SYSTEM_PROMPT,
  WIKI_DATA_TOOL,
  buildUserMessage,
} from "../../setup/lib/llm-config";

export const runtime = "nodejs";
export const maxDuration = 60;

// In-memory rate limit. Per-process — ephemeral on Vercel serverless,
// good enough for MVP. Replace with Upstash/Redis when traffic grows.
const ipHits = new Map(); // ip -> { count, day }

function clientIp(req) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function checkRateLimit(ip) {
  const limit = parseInt(process.env.RATE_LIMIT_PER_DAY || "10", 10);
  if (limit <= 0) return { ok: true };
  const today = new Date().toISOString().slice(0, 10);
  const cur = ipHits.get(ip);
  if (!cur || cur.day !== today) {
    ipHits.set(ip, { count: 1, day: today });
    return { ok: true, remaining: limit - 1 };
  }
  if (cur.count >= limit) {
    return {
      ok: false,
      reason: `Daily limit of ${limit} generations reached for this IP. Try again tomorrow.`,
    };
  }
  cur.count += 1;
  return { ok: true, remaining: limit - cur.count };
}

async function extractPdfText(base64) {
  // pdf-parse is server-only; dynamic import keeps it out of any client bundle.
  const pdfParse = (await import("pdf-parse")).default;
  const buf = Buffer.from(base64, "base64");
  if (buf.length > 5 * 1024 * 1024) {
    throw new Error("PDF too large (max 5 MB).");
  }
  const result = await pdfParse(buf);
  return (result.text || "").trim();
}

export async function POST(req) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      {
        error:
          "Server is missing ANTHROPIC_API_KEY. The tool owner needs to set this env var.",
      },
      { status: 500 }
    );
  }

  const ip = clientIp(req);
  const rate = checkRateLimit(ip);
  if (!rate.ok) {
    return Response.json({ error: rate.reason }, { status: 429 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { pdfBase64, text } = body || {};
  if (!pdfBase64 && !text) {
    return Response.json(
      { error: "Provide either `pdfBase64` or `text`." },
      { status: 400 }
    );
  }

  let sourceText = "";
  try {
    if (pdfBase64) {
      sourceText = await extractPdfText(pdfBase64);
    }
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
          "Source text is too short to generate a meaningful bio (need at least ~30 characters of real content).",
      },
      { status: 400 }
    );
  }

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  let response;
  try {
    response = await anthropic.messages.create({
      model: MODEL_ID,
      max_tokens: MAX_TOKENS,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [WIKI_DATA_TOOL],
      tool_choice: { type: "tool", name: WIKI_DATA_TOOL.name },
      messages: [
        {
          role: "user",
          content: buildUserMessage(sourceText),
        },
      ],
    });
  } catch (e) {
    const status = e?.status || 500;
    return Response.json(
      { error: `LLM call failed: ${e.message || "unknown error"}` },
      { status }
    );
  }

  const toolBlock = (response.content || []).find(
    (b) => b.type === "tool_use" && b.name === WIKI_DATA_TOOL.name
  );
  if (!toolBlock || !toolBlock.input) {
    return Response.json(
      {
        error:
          "Model did not return structured data. Try again or paste a longer source text.",
      },
      { status: 502 }
    );
  }

  const usage = response.usage || {};
  const inputTokens =
    (usage.input_tokens || 0) +
    (usage.cache_creation_input_tokens || 0) +
    (usage.cache_read_input_tokens || 0);
  const outputTokens = usage.output_tokens || 0;

  // Haiku 4.5 pricing: $1/M input, $5/M output (cache read $0.10/M).
  // Rough non-cached estimate.
  const estCostUsd =
    (inputTokens * 1) / 1_000_000 + (outputTokens * 5) / 1_000_000;

  return Response.json(
    {
      data: toolBlock.input,
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
