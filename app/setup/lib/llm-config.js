// Shared LLM config: system prompt + tool schema for structured output.
// Used by /api/parse on the server. Imported nowhere on the client.

export const MODEL_ID = "claude-haiku-4-5-20251001";
export const MAX_TOKENS = 2048;

export const SYSTEM_PROMPT = `You are a JSON-emitting assistant that converts a user's résumé or freeform self-description into structured data for a Wikipedia-style personal wiki.

VOICE RULES for any prose you write (bio, project descriptions):
- Third person always ("Doe began her career at...", never "I started").
- Restrained Wikipedia register. No marketing language ("pioneer", "visionary", "world-class", "transformative").
- Prefer "known for" over "famous for"; "argues that" over "proved that".
- No emojis. No exclamation marks. No second-person ("you").
- Numbers need a context clause ("a simulated backtest achieved approximately 50 percent annualized return").

FIELD SEMANTICS:
- name: full name in the form a Wikipedia article would reference. For CJK names, use the Latin form ("Wang Xuzhou", not "王旭洲").
- homepageSlug: URL slug, Title_Case_With_Underscores (e.g. "Jane_Doe", "Wang_Xuzhou"). Always start with a capital letter.
- tagline: one-line italic subtitle. ~6-12 words. Identity, not hype.
- bio: 2-3 paragraphs of third-person prose. Cover career arc → notable work → current focus. Each paragraph ends on a clear thought; do not run on. ~120-220 words total.
- siteName: site brand name. If the user proposed one, keep it. Otherwise default to "Yourpedia".
- email / linkedin / githubProfile: extract verbatim if the source explicitly contains them. Empty string if not mentioned. Never invent.
- metaBaseUrl: usually empty string. The user fills this after deploy.
- githubOwner / githubRepo: extract from any GitHub URL mentioned. Owner is the username, repo is the repo name. Empty if not present.
- shipped: array of up to 5 notable shipped projects/products, sorted by significance. Each item is { name, description }. Description is a short noun phrase (e.g. "iOS App Store, 2025" or "open-source agent framework, 100+ stars"), max ~80 chars.

HARD RULES:
- Do not invent facts. If the source does not mention something, leave the field empty.
- Do not fabricate URLs, employer names, or project names.
- If the source is too short or too vague to fill bio meaningfully (< 40 words of substance), still return valid JSON but with bio set to a one-sentence honest placeholder ("[Bio could not be reliably generated — please write yourself.]") so the user knows to fill it.`;

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
        description: "Full name as a Wikipedia article would reference.",
      },
      homepageSlug: {
        type: "string",
        description: "URL slug, Title_Case_With_Underscores.",
        pattern: "^[A-Z][A-Za-z0-9_]*$",
      },
      tagline: {
        type: "string",
        description: "One-line italic subtitle, 6-12 words.",
      },
      bio: {
        type: "string",
        description:
          "2-3 paragraph third-person Wikipedia-style prose, ~120-220 words.",
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
            name: { type: "string" },
            description: {
              type: "string",
              description:
                "Short noun phrase, max ~80 chars. e.g. 'iOS App Store, 2025'.",
            },
          },
          required: ["name", "description"],
        },
      },
    },
    required: [
      "name",
      "homepageSlug",
      "tagline",
      "bio",
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
