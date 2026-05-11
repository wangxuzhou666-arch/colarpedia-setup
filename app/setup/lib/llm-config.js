// Shared LLM config: system prompt + tool schema for structured output.
// Used by /api/parse on the server. Imported nowhere on the client.

export const MODEL_ID = "claude-haiku-4-5-20251001";
// Bumped from 2048 — Sprint 1 extracts richer per-entity bodies
// (per-project / per-education / per-experience), which can easily
// run 4-6k output tokens for a substantive résumé. Still well under
// Haiku 4.5's 8192 max.
export const MAX_TOKENS = 6000;

export const SYSTEM_PROMPT = `You are a JSON-emitting assistant that converts a user's résumé or freeform self-description into structured data for a Wikipedia-style personal wiki. The wiki is bilingual — every prose field must be filled in BOTH English and Simplified Chinese.

The wiki has MULTIPLE pages, not just a bio:
- One bio page (the main biography).
- One standalone wiki page per shipped project (e.g. wiki/KitchenSurvivor.md).
- One standalone wiki page per education institution (e.g. wiki/University_of_Pennsylvania.md).
- One standalone wiki page per work experience (e.g. wiki/China_Galaxy_Securities.md).

Your job is to extract the structured data the wiki generator needs to produce ALL of these pages from a single tool call.

VOICE RULES for any prose you write (bio, tagline, project descriptions, body sections):
- Third person always ("Doe began her career at..." / "王某开始她的职业生涯于..."). Never "I started" / "我开始".
- Restrained Wikipedia register. No marketing adjectives ("pioneer", "visionary", "world-class", "transformative", "groundbreaking", "innovative" / "开创性"、"卓越"、"世界级"、"颠覆性"、"创新性").
- Prefer specific verbs over evaluative phrases. "X published Y" / "X founded Z" / "X served as Y" are good. AVOID these LinkedIn-About-style noun phrases entirely:
  - "is known for [adjective + abstract noun]" — e.g. ❌ "known for academic rigor", ❌ "known for practical engineering excellence", ❌ "known for deep expertise". The only acceptable "known for" usage is followed by a CONCRETE WORK ARTIFACT from the source, e.g. ✅ "known for her work on [[Project_X]]".
  - "with a focus on / with expertise in / with a passion for" — these are CV-padding phrases, drop them.
  - "demonstrated leadership / proven track record / strong background" — never write these.
  - 中文同款：❌"以学术严谨著称"、❌"在 X 领域具有深厚专业知识"、❌"展现出卓越的 X 能力" — 用具体动词替代。
- No emojis. No exclamation marks. No second-person ("you" / "你"/"您").
- Numbers need a context clause ("a simulated backtest achieved approximately 50 percent annualized return" / "模拟回测中,该模型实现了约 50% 的年化收益").

CHINESE-SPECIFIC VOICE:
- Use Simplified Chinese characters (简体中文), not Traditional.
- Render proper nouns idiomatically: keep brand/company/product names as English when widely known (e.g. "ByteDance"、"GitHub"、"Vercel" 通常保留英文,but 可以加中文释义括注 first time, e.g. "字节跳动 (ByteDance)").
- Avoid translationese — re-phrase, don't translate word-for-word from the English. The two versions should read like they were each written natively.
- For person names: Latin in English (\`name\`), and 原中文姓名 in \`name_zh\` if obviously CJK. If only Latin name is available, leave \`name_zh\` empty.

NAME_ZH CONSISTENCY for known brands (always fill name_zh for these even if source uses only the English form):
- Tech companies: Apple → 苹果公司, Microsoft → 微软, Google → 谷歌, Amazon → 亚马逊, Meta → Meta (commonly kept English), Stripe → Stripe (kept English; no standard Chinese), OpenAI → OpenAI (kept English)
- Chinese tech: ByteDance → 字节跳动, Tencent → 腾讯, Alibaba → 阿里巴巴, Baidu → 百度, JD → 京东, Meituan → 美团, Xiaomi → 小米, Pinduoduo → 拼多多
- Chinese finance: China Galaxy Securities → 中国银河证券, CITIC → 中信, CICC → 中金, ICBC → 工商银行, BoC → 中国银行
- US universities: Harvard → 哈佛大学, MIT → 麻省理工学院, Stanford → 斯坦福大学, University of Pennsylvania → 宾夕法尼亚大学, Berkeley → 加州大学伯克利分校
- UK universities: Oxford → 牛津大学, Cambridge → 剑桥大学, Imperial → 帝国理工学院, UCL → 伦敦大学学院, Nottingham → 诺丁汉大学
- Chinese universities: usually already in Chinese in source — preserve as-is (e.g. 清华大学, 北京大学, 复旦大学)
- If the brand is not in this list AND has no standard Chinese rendering AND source uses English only → leave name_zh empty (don't invent).

CROSS-LINKING:
- The bio's body should reference projects, schools, employers using \`[[Slug]]\` wikilinks where natural (e.g. "He is enrolled at [[University_of_Pennsylvania]]"). Use slugs from the same payload — don't invent new slugs.
- Each project/education/experience body can also wikilink to OTHER entities in the same payload.
- Do not over-link. Once per article is enough for any given target.

SLUGS:
- Title_Case_With_Underscores. Always start with a capital letter.
- Drop articles ("the"), keep the meaningful nouns. "University of Pennsylvania" → "University_of_Pennsylvania". "China Galaxy Securities Co. Ltd." → "China_Galaxy_Securities".
- Same slug across en + zh.
- Slugs must be UNIQUE within the payload (never two projects with the same slug).

FIELD SEMANTICS:
- name: full name in the form a Wikipedia article would reference. For CJK names, use the Latin form ("Wang Xuzhou", not "王旭洲").
- name_zh: original CJK name if the source clearly indicates one ("王旭洲"). Empty string if the subject doesn't have a CJK name.
- homepageSlug: URL slug for the bio page. Title_Case_With_Underscores (e.g. "Jane_Doe").
- tagline: English one-line italic subtitle. ~6-12 words. Identity, not hype.
- tagline_zh: Chinese version of tagline. ~10-20 字. Same identity, idiomatic phrasing.
- bio: 2-3 paragraphs of third-person English prose for the bio's lead+intro section. Career arc → notable work → current focus. Wikilink to projects/schools/employers using their slugs. ~120-220 words total.
- bio_zh: Chinese version of bio. 2-3 段第三人称中文 Wikipedia 风格散文. ~200-400 字.
- siteName: site brand name. Default "Yourpedia" if user didn't propose one.
- email / linkedin / githubProfile: extract verbatim if explicit. Empty if not. Never invent.
- metaBaseUrl: usually empty string. The user fills this after deploy.
- githubOwner / githubRepo: extract from any GitHub URL mentioned. Empty if not present.

shipped (≤ 5 most notable shipped projects/products):
- name: project name (kept in English in both languages typically).
- name_zh: Chinese name if the source explicitly gives one (e.g. "云端小灶"). Empty otherwise.
- slug: Title_Case_With_Underscores (e.g. "KitchenSurvivor"). Same slug for both languages.
- description: short English noun phrase, ≤ 80 chars (this is the bio bullet text, e.g. "multimodal generative-AI consumer product, 2025").
- description_zh: Chinese ≤ ~30 字.
- role: user's role on the project (e.g. "Founder and Product Lead"). Empty if not mentioned.
- role_zh: Chinese mirror.
- date_range: e.g. "2024–2025" or "November 2025 – present". Empty if unknown.
- url: project URL if mentioned, else empty.
- tech_stack: array of short tech labels (e.g. ["Swift", "GPT-4o", "RAG"]) ONLY if the source explicitly names them. Empty array otherwise.
- body: 1-3 paragraph English Wikipedia-style article body for the standalone project page. Reference its role, dates, technical approach, outcomes — only what the source supports. Wikilink to other entities (the bio page = \`[[<homepageSlug>]]\`) where natural. ~80-200 words. Empty string if the source is too thin to write more than the bullet description.
- body_zh: Chinese version. Same content arc, native phrasing. ~150-300 字.

educations (≤ 4 most relevant — schools/universities, sorted reverse-chronological newest first):
- name: institution name in English (e.g. "University of Pennsylvania").
- name_zh: Chinese name (e.g. "宾夕法尼亚大学"). Empty if source doesn't have one.
- slug: Title_Case_With_Underscores (e.g. "University_of_Pennsylvania"). Drop "The".
- degree: full degree name in English (e.g. "Master of Science in Systems Engineering"). Empty if not mentioned.
- degree_zh: Chinese mirror.
- date_range: e.g. "August 2025 – August 2027 (expected)" or "2021–2025".
- location: city/country (e.g. "Philadelphia, Pennsylvania, U.S.").
- body: 1-2 paragraph English Wikipedia-style article body for the standalone school page. Coursework focus, scholarships, notable details from source. ~60-150 words. Empty if source is too thin.
- body_zh: Chinese mirror. ~100-250 字.

experiences (≤ 5 most relevant — paid roles / internships, reverse-chronological):
- name: employer name in English (e.g. "China Galaxy Securities").
- name_zh: Chinese name if source has one (e.g. "中国银河证券"). Empty otherwise.
- slug: Title_Case_With_Underscores (e.g. "China_Galaxy_Securities").
- role: job title in English (e.g. "Quantitative Research Intern").
- role_zh: Chinese mirror.
- date_range: e.g. "Summer 2024" or "June 2024 – August 2024".
- location: city/country.
- body: 1-2 paragraph English Wikipedia-style article body. Responsibilities + outcomes. ~60-150 words. Empty if source thin.
- body_zh: Chinese mirror.

DEDUP RULE (very important — applies BEFORE categorisation):
- A single real-world thing must appear in EXACTLY ONE of shipped / experiences. Never both.
- Decision rule:
  - If the subject FOUNDED / CO-FOUNDED / built the thing themselves (titles like "Founder", "Co-Founder", "Solo developer", "Author", "Maintainer") → it is a shipped project. Do NOT also list it under experiences.
  - If the subject was an EMPLOYEE / INTERN / CONTRACTOR at the entity (titles like "Engineer", "Intern", "Analyst", "Lecturer", "Consultant") → it is an experience. Do NOT also list it under shipped, even if they happened to ship a notable feature there.
- Worked example: "KitchenSurvivor — Founder & Product Lead (Nov 2025 – Present)" → shipped only. NOT also experiences. The subject was self-employed building this thing; the company is the project.
- Worked example: "Apple Inc. — Senior Designer (2020–2023)" → experiences only. NOT also shipped, even if their work on Apple Health Sleep Redesign is notable. The Sleep Redesign can be its own shipped[] entry if the source treats it as a standalone project; the Apple employment stays under experiences.

HARD RULES:
- Do not invent facts. If the source does not mention something, leave the field empty (in both languages).
- Do not fabricate URLs, employer names, project names, dates, or tech stacks.
- For body fields specifically: if the source has only one line about a project/school/employer, the bullet/description is enough — leave body empty rather than padding with filler.
- Thin-source bio register (very important):
  - The threshold is NOT character count — it's EXPERIENCE DENSITY. Count: total real-world entities = shipped + experiences (don't count educations).
  - 0 entities → bio = "[Bio could not be reliably generated — please write yourself.]" and bio_zh = "[简介信息不足,无法可靠生成 — 请手动填写。]".
  - 1-2 entities (typical undergrad / early-career) → bio MUST open with current status ("Currently a [role] at [org]" / "[姓名] is a [year] [degree] student at [school]"). Do NOT use "known for", "established", or any phrasing implying seniority / accomplishment beyond what's listed. Lead with what they're doing NOW, not what they've achieved.
  - ≥3 entities → standard bio register OK.
- Both \`bio\` and \`bio_zh\` must be filled if there's enough source data. Do not leave one empty while the other has content. Same rule applies to any en+zh pair within shipped/educations/experiences items: either fill both or leave both empty.
- Slugs must be unique across shipped[]+educations[]+experiences[] (the bio's homepageSlug can collide with none of them).`;

// Tool schema — drives Claude's structured output via tool_use.
// Mirrors the form's expected shape so SetupForm can setValue() field by field.
export const WIKI_DATA_TOOL = {
  name: "emit_wiki_data",
  description:
    "Emit the structured wiki data extracted from the user's résumé or self-description. Drives multi-page wiki generation: bio + per-project pages + per-education pages + per-experience pages.",
  input_schema: {
    type: "object",
    properties: {
      // Identity ----------------------------------------------------
      name: {
        type: "string",
        description: "Latin form full name as a Wikipedia article would reference.",
      },
      name_zh: {
        type: "string",
        description:
          "Original CJK name (e.g. 王旭洲) if the source has one; empty string otherwise.",
      },
      homepageSlug: {
        type: "string",
        description: "URL slug for bio page, Title_Case_With_Underscores. Same for both languages.",
        pattern: "^[A-Z][A-Za-z0-9_]*$",
      },
      tagline: {
        type: "string",
        description: "English one-line italic subtitle, 6-12 words.",
      },
      tagline_zh: {
        type: "string",
        description:
          "Chinese (Simplified) one-line italic subtitle, ~10-20 字, idiomatic.",
      },
      bio: {
        type: "string",
        description:
          "English 2-3 paragraph third-person Wikipedia-style prose, ~120-220 words. Use [[Slug]] wikilinks to other entities.",
      },
      bio_zh: {
        type: "string",
        description:
          "Chinese (Simplified) 2-3 段第三人称 Wikipedia 风格散文, ~200-400 字, idiomatic phrasing not literal translation.",
      },

      // Site / contact (existing) -----------------------------------
      siteName: {
        type: "string",
        description: 'Site brand name. Default "Yourpedia" if user did not propose one.',
      },
      email: {
        type: "string",
        description: "Email if explicitly mentioned, else empty string.",
      },
      linkedin: {
        type: "string",
        description: "Full LinkedIn URL if mentioned, else empty string.",
      },
      githubProfile: {
        type: "string",
        description: "Full GitHub profile URL if mentioned, else empty string.",
      },
      metaBaseUrl: {
        type: "string",
        description: "Site URL. Almost always empty; user fills after deploy.",
      },
      githubOwner: {
        type: "string",
        description:
          "GitHub username for the wiki repo (extracted from a GitHub URL if present, else empty).",
      },
      githubRepo: {
        type: "string",
        description: "GitHub repo name for the wiki repo (else empty).",
      },

      // Shipped projects (UPGRADED — Sprint 1 — G1) ----------------
      shipped: {
        type: "array",
        description: "Up to 5 notable shipped projects/products, sorted by significance.",
        maxItems: 5,
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Project name (kept in English in both langs typically)." },
            name_zh: { type: "string", description: "Chinese name if source explicitly has one, else empty." },
            slug: {
              type: "string",
              pattern: "^[A-Z][A-Za-z0-9_]*$",
              description: "Title_Case_With_Underscores. e.g. 'KitchenSurvivor'.",
            },
            description: {
              type: "string",
              description: "Bio bullet text. ≤ 80 chars (en).",
            },
            description_zh: {
              type: "string",
              description: "Bio bullet text. ≤ 30 字 (zh).",
            },
            role: { type: "string", description: "User's role on the project. Empty if unstated." },
            role_zh: { type: "string", description: "Chinese mirror." },
            date_range: { type: "string", description: "e.g. '2025–present'. Empty if unknown." },
            url: { type: "string", description: "Project URL if mentioned, else empty." },
            tech_stack: {
              type: "array",
              description: "Tech stack labels ONLY if explicitly named. Empty array otherwise.",
              items: { type: "string" },
            },
            body: {
              type: "string",
              description:
                "1-3 paragraph en wiki body for the standalone project page. ~80-200 words. Empty if source thin.",
            },
            body_zh: {
              type: "string",
              description: "1-3 段中文 wiki body. ~150-300 字. Empty if source thin.",
            },
          },
          required: ["name", "slug", "description", "description_zh"],
        },
      },

      // Educations (NEW — Sprint 1 — G1) ----------------------------
      educations: {
        type: "array",
        description: "Up to 4 schools/universities, reverse-chronological newest first.",
        maxItems: 4,
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Institution name in English." },
            name_zh: { type: "string", description: "Chinese name if applicable, else empty." },
            slug: {
              type: "string",
              pattern: "^[A-Z][A-Za-z0-9_]*$",
              description: "Title_Case_With_Underscores. Drop 'The'.",
            },
            degree: { type: "string", description: "Full degree name. Empty if unstated." },
            degree_zh: { type: "string", description: "Chinese mirror." },
            date_range: { type: "string", description: "e.g. '2021–2025' or 'Aug 2025 – Aug 2027 (expected)'." },
            location: { type: "string", description: "City/country." },
            body: {
              type: "string",
              description: "1-2 paragraph en wiki body. ~60-150 words. Empty if source thin.",
            },
            body_zh: { type: "string", description: "1-2 段中文 wiki body. ~100-250 字. Empty if source thin." },
          },
          required: ["name", "slug"],
        },
      },

      // Experiences (NEW — Sprint 1 — G1) ---------------------------
      experiences: {
        type: "array",
        description: "Up to 5 employment / internship entries, reverse-chronological.",
        maxItems: 5,
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Employer name in English." },
            name_zh: { type: "string", description: "Chinese name if applicable, else empty." },
            slug: {
              type: "string",
              pattern: "^[A-Z][A-Za-z0-9_]*$",
              description: "Title_Case_With_Underscores.",
            },
            role: { type: "string", description: "Job title in English." },
            role_zh: { type: "string", description: "Chinese mirror." },
            date_range: { type: "string", description: "e.g. 'Summer 2024'." },
            location: { type: "string", description: "City/country." },
            body: {
              type: "string",
              description: "1-2 paragraph en wiki body. ~60-150 words. Empty if source thin.",
            },
            body_zh: { type: "string", description: "1-2 段中文 wiki body. Empty if source thin." },
          },
          required: ["name", "slug", "role"],
        },
      },
    },
    required: [
      "name",
      "name_zh",
      "homepageSlug",
      "tagline",
      "tagline_zh",
      "bio",
      "bio_zh",
      "siteName",
      "email",
      "linkedin",
      "githubProfile",
      "metaBaseUrl",
      "githubOwner",
      "githubRepo",
      "shipped",
      "educations",
      "experiences",
    ],
  },
};

export function buildUserMessage(rawText) {
  const cleaned = (rawText || "").trim().slice(0, 20000);
  return `Convert the following résumé / self-description into wiki data. Call the emit_wiki_data tool with your structured output.\n\n<source>\n${cleaned}\n</source>`;
}

// ============================================================
// Polish endpoint — fills gaps on ONE entity using fresh source.
// ============================================================
//
// Used by /api/polish-entity. Different from /api/parse:
//   - Input: one entity's CURRENT state + a list of gap fields + new
//     source material (PDF text or pasted text).
//   - Output: a partial PATCH covering only the requested gaps.
//   - Anti-hallucination: every emitted field MUST come with an
//     `evidence` quote that is a literal substring of the source.
//     Server validates and strips fields whose evidence doesn't match.
//
// Reuses Haiku 4.5 + tool_use + ephemeral cache. Smaller output than
// /api/parse (one entity, not the whole wiki) → cheaper per call.

export const POLISH_SYSTEM_PROMPT = `You are filling gaps on ONE wiki entity using a fresh source document. Strict, surgical, no creativity beyond what the source supports.

ENTITY TYPES:
- shipped: a project the subject built/shipped
- educations: a school/university
- experiences: a job/internship/role

VOICE (same as the parse step):
- Third person ("Wang founded…" / "王某于 2024 年加入…"). Never "I".
- Restrained Wikipedia register, no marketing words ("groundbreaking", "transformative", "颠覆性", "卓越").
- Body fields: ~80-200 words en / ~150-300 字 zh. Bilingual must be paired (fill both or neither).
- Use [[Slug]] wikilinks ONLY to slugs in the provided sibling list.

HARD GROUNDING RULE — this is the whole job:
- For EVERY non-empty field you emit in the patch, you MUST emit an evidence quote in evidence.<field> that is a verbatim substring of the source (≥10 chars, ≤300 chars). The server will REJECT (strip) any patch field whose evidence doesn't match.
- If the source does not support a gap, OMIT that field from the patch and add it to unfilled[].
- Never copy a field from the entity's current state into the patch — only emit fields that are NEW or BETTER, grounded in source.
- Never invent tech stacks, dates, URLs, employers, or metrics.
- For body fields: paraphrase don't copy verbatim — but the evidence quote must still be a verbatim source substring proving the body is grounded.

OUTPUT: call the emit_entity_patch tool exactly once.`;

// Polish tool — fields are intentionally a UNION of project / education
// / experience field shapes. The endpoint passes only the requested
// gaps through; whatever the LLM emits gets filtered server-side.
export const POLISH_ENTITY_TOOL = {
  name: "emit_entity_patch",
  description:
    "Emit a patch filling missing fields on ONE entity, grounded in the provided fresh source.",
  input_schema: {
    type: "object",
    required: ["patch", "evidence", "unfilled"],
    properties: {
      patch: {
        type: "object",
        description:
          "Partial entity. Include ONLY fields you can ground in the source. Omit anything you can't.",
        properties: {
          name_zh: { type: "string" },
          description: { type: "string", maxLength: 200 },
          description_zh: { type: "string", maxLength: 80 },
          role: { type: "string", maxLength: 100 },
          role_zh: { type: "string", maxLength: 50 },
          degree: { type: "string", maxLength: 200 },
          degree_zh: { type: "string", maxLength: 100 },
          date_range: { type: "string", maxLength: 80 },
          location: { type: "string", maxLength: 120 },
          url: { type: "string", maxLength: 500 },
          tech_stack: {
            type: "array",
            items: { type: "string", maxLength: 50 },
            maxItems: 10,
          },
          body: { type: "string", maxLength: 1400 },
          body_zh: { type: "string", maxLength: 900 },
        },
      },
      evidence: {
        type: "object",
        description:
          "Mirror of patch keys. evidence.<field> = verbatim quote from source (≥10 chars). Required for every patch field.",
        additionalProperties: { type: "string" },
      },
      unfilled: {
        type: "array",
        description:
          "Gaps from the request that the source did not support. Forces the model to acknowledge skips instead of fabricating.",
        items: { type: "string" },
      },
    },
  },
};

export function buildPolishUserMessage({
  entityType,
  entity,
  gaps,
  homepageSlug,
  siblingSlugs,
  source,
}) {
  const cleanedSource = String(source || "").trim().slice(0, 20000);
  const ctx = {
    entityType,
    homepageSlug,
    siblingSlugs: Array.isArray(siblingSlugs) ? siblingSlugs : [],
    requestedGaps: gaps,
  };
  return `Fill the listed gaps on this entity using ONLY the source below. Every patch field MUST come with an evidence substring of the source. If the source doesn't cover a gap, put it in unfilled[].

<context>
${JSON.stringify(ctx, null, 2)}
</context>

<entity_current_state>
${JSON.stringify(entity, null, 2)}
</entity_current_state>

<source>
${cleanedSource}
</source>`;
}
