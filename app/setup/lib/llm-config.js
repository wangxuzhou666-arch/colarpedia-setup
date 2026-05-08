// Shared LLM config: system prompt + tool schema for structured output.
// Used by /api/parse on the server. Imported nowhere on the client.

export const MODEL_ID = "claude-haiku-4-5-20251001";
export const MAX_TOKENS = 2048;

export const SYSTEM_PROMPT = `You are a JSON-emitting assistant that converts a user's résumé or freeform self-description into structured data for a Wikipedia-style personal wiki. The wiki is bilingual — every prose field must be filled in BOTH English and Simplified Chinese.

VOICE RULES for any prose you write (bio, tagline, project descriptions):
- Third person always ("Doe began her career at..." / "王某开始她的职业生涯于..."). Never "I started" / "我开始".
- Restrained Wikipedia register. No marketing language ("pioneer", "visionary", "world-class", "transformative" / "开创性"、"卓越"、"世界级"、"颠覆性").
- Prefer "known for" over "famous for"; "argues that" over "proved that". Chinese: 用"以…著称"而非"以…闻名";"主张"而非"证明".
- No emojis. No exclamation marks. No second-person ("you" / "你"/"您").
- Numbers need a context clause ("a simulated backtest achieved approximately 50 percent annualized return" / "模拟回测中,该模型实现了约 50% 的年化收益").

CHINESE-SPECIFIC VOICE:
- Use Simplified Chinese characters (简体中文), not Traditional.
- Render proper nouns idiomatically: keep brand/company/product names as English when widely known (e.g. "ByteDance"、"GitHub"、"Vercel" 通常保留英文,but 可以加中文释义括注 first time, e.g. "字节跳动 (ByteDance)").
- Avoid translationese — re-phrase, don't translate word-for-word from the English. The two versions should read like they were each written natively.
- For person names: Latin in English (\`name\`), and 原中文姓名 in \`name_zh\` if obviously CJK. If only Latin name is available, leave \`name_zh\` empty.

FIELD SEMANTICS:
- name: full name in the form a Wikipedia article would reference. For CJK names, use the Latin form ("Wang Xuzhou", not "王旭洲").
- name_zh: original CJK name if the source clearly indicates one ("王旭洲"). Empty string if the subject doesn't have a CJK name.
- homepageSlug: URL slug, Title_Case_With_Underscores (e.g. "Jane_Doe", "Wang_Xuzhou"). Always start with a capital letter. Same slug for both languages — Chinese pages live at /zh/wiki/<Slug>/.
- tagline: English one-line italic subtitle. ~6-12 words. Identity, not hype.
- tagline_zh: Chinese version of tagline. ~10-20 字. Same identity, idiomatic phrasing.
- bio: 2-3 paragraphs of third-person English prose. Career arc → notable work → current focus. ~120-220 words total.
- bio_zh: Chinese version of bio. 2-3 段第三人称中文 Wikipedia 风格散文。Same content arc, native Chinese phrasing (not a literal translation). ~200-400 字.
- siteName: site brand name. Default "Yourpedia". Same value for both languages (the toggle in the wiki shell switches just the language strings, not the site name).
- email / linkedin / githubProfile: extract verbatim if the source explicitly contains them. Empty string if not mentioned. Never invent.
- metaBaseUrl: usually empty string. The user fills this after deploy.
- githubOwner / githubRepo: extract from any GitHub URL mentioned. Empty if not present.
- shipped: array of up to 5 notable shipped projects/products, sorted by significance. Each item is { name, description, description_zh }. \`name\` stays the same in both languages (product names usually do). \`description\` is a short English noun phrase, max ~80 chars. \`description_zh\` is the Chinese equivalent, ~15-30 字, idiomatic.

HARD RULES:
- Do not invent facts. If the source does not mention something, leave the field empty (in both languages).
- Do not fabricate URLs, employer names, or project names.
- If the source is too short to fill bio meaningfully (< 40 words of substance), set bio to "[Bio could not be reliably generated — please write yourself.]" and bio_zh to "[简介信息不足,无法可靠生成 — 请手动填写。]" so the user knows to write it.
- Both \`bio\` and \`bio_zh\` must be filled if there's enough source data. Do not leave one empty while the other has content.`;

// Tool schema — drives Claude's structured output via tool_use.
// Mirror the form's expected shape so SetupForm can setValue() field by field.
export const WIKI_DATA_TOOL = {
  name: "emit_wiki_data",
  description:
    "Emit the structured wiki data extracted from the user's résumé or self-description.",
  input_schema: {
    type: "object",
    properties: {
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
        description: "URL slug, Title_Case_With_Underscores. Same for both languages.",
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
          "English 2-3 paragraph third-person Wikipedia-style prose, ~120-220 words.",
      },
      bio_zh: {
        type: "string",
        description:
          "Chinese (Simplified) 2-3 段第三人称 Wikipedia 风格散文, ~200-400 字, idiomatic phrasing not literal translation.",
      },
      siteName: {
        type: "string",
        description:
          'Site brand name. Default "Yourpedia" if user did not propose one.',
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
        description:
          "Site URL. Almost always empty; user fills after deploy.",
      },
      githubOwner: {
        type: "string",
        description:
          "GitHub username for the wiki repo (extracted from a GitHub URL if present, else empty).",
      },
      githubRepo: {
        type: "string",
        description:
          "GitHub repo name for the wiki repo (else empty).",
      },
      shipped: {
        type: "array",
        description:
          "Up to 5 notable shipped projects/products, sorted by significance.",
        maxItems: 5,
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description:
                "Project name. Same in both languages (product names usually keep English).",
            },
            description: {
              type: "string",
              description:
                "Short English noun phrase, max ~80 chars. e.g. 'iOS App Store, 2025'.",
            },
            description_zh: {
              type: "string",
              description:
                "Chinese description, ~15-30 字, idiomatic. e.g. 'iOS 应用,2025 年上架'.",
            },
          },
          required: ["name", "description", "description_zh"],
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
    ],
  },
};

export function buildUserMessage(rawText) {
  const cleaned = (rawText || "").trim().slice(0, 20000);
  return `Convert the following résumé / self-description into wiki data. Call the emit_wiki_data tool with your structured output.\n\n<source>\n${cleaned}\n</source>`;
}
