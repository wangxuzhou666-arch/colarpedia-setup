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
- Prefer specific verbs over evaluative phrases. "X published Y" / "X founded Z" / "X served as Y" are good.
- No emojis. No exclamation marks. No second-person ("you" / "你"/"您").
- Numbers need a context clause AND an absolute baseline. ❌ "20% 的回报率提升" (no baseline) → ✅ "ROAS 从 1.6 升至 1.9 (约 +20%)" or just absolute "ROAS 1.9 (vs prior 1.6)". If you don't have the baseline, write the absolute number or skip the comparison — never report a percentage without what it's relative to.

ANTI AI-VOICE TELLS (critical — these patterns make prose read like AI slop and destroy HR-reader trust):

A. Empty-summary endings (MOST FATAL — kills bios for HR readers):
- ❌ "X 的工作涵盖 A、B、C、D" / "X's work spans A, B, C and D"
- ❌ "X 致力于 / 专注于 / 关注 [abstract phrase]" / "X is dedicated to / focuses on [abstract noun]"
- ❌ "X 在 Y 方面具备深厚的 Z" / "X possesses strong Z in Y"
- ❌ "with a focus on / with expertise in / with a passion for" — CV-padding, never use.
- ❌ "demonstrated leadership / proven track record / strong background" — never write these.
- ❌ "is known for [adjective + abstract noun]" — e.g. ❌ "known for academic rigor". Only ✅ form: "known for [[Concrete_Work]]".
- ❌ Any sentence whose only job is to summarize the paragraph in noun-phrase form.
- ✅ End the bio on a specific recent fact ("最近一次更新发布于 2025 年 12 月") OR just STOP where the facts stop. Empty wrap-up sentences are worse than a hard stop.
- 中文同款 LinkedIn 套话: ❌"以学术严谨著称"、❌"具有深厚专业知识"、❌"展现出卓越能力" — 用具体动词替代。

B. Abstract-noun stacking (列举抽象名词当 padding):
- ❌ "端到端 X、可扩展 Y、产品战略、市场拓展执行" — 4 个抽象短语并列
- ❌ "程序化广告系统和产品策略框架" — 一句 2 个抽象大词
- ❌ "多模态生成式 AI 平台" — 3 个抽象词堆砌
- ✅ 拆成具体句: "为 X 团队搭了一套基于 Y 的回测器,接入了 Z 数据源,跑了 N 个月"
- ✅ AI 产品具体化: ❌ "多模态生成式 AI 平台" → ✅ "用 GPT-4o 生成菜谱的 iOS app" (具体模型 + 具体形态)

C. AI-vibe phrasing (this is NOT about banning the word "AI" — it's about banning AI-marketing tone):
- "AI" as a factual descriptor of the user's actual work is FINE ("AI 产品工程师" / "AI engineer" if that's their title is OK).
- ❌ BANNED: marketing-style "AI" usage:
  - "AI 帮你 X" / "AI-powered X" — marketing copy register
  - "多模态生成式 AI 平台 / 端到端 AI 管道" — abstract category stacking with AI tacked on
  - "AI 驱动的 / AI 赋能的" / "AI-driven / AI-enabled" — empty modifier
- ✅ When source mentions AI/ML, describe the SPECIFIC technique + product form: "用 RAG 检索 + GPT-4o 生成菜谱" instead of "AI-powered cooking platform".

D. Translationese (writing Chinese as literal English translation):
- ❌ "驻费城" (based in Philadelphia) → ✅ "现居费城" / "在费城求学"
- ❌ "领导 X 的开发" (leads development of X) → ✅ "正在开发 X" / "目前在做 X"
- ❌ "技术基础来自 X" (technical foundation comes from X) → ✅ "本科 / 研究生就读于 X" + 具体课程
- ❌ "产品市场契合度" (PMF 直译生硬) → ✅ 直接用 "PMF" 或描述具体场景 ("找到了愿意付费的用户群")
- ❌ "职业生涯早期" (early in his career) — too vague → ✅ 给具体年份段

E. Parallelism / triplets / 同义反复:
- ❌ "设计了 X 和 Y,实现了 A 和 B" — 一句两个动作两个对象 = AI reflex
- ❌ "探索与研究 / 思考并实践 / 设计并实现 / 关注并致力于" — 同义反复
- ❌ "不仅... 而且... 还..." 三连
- ✅ 一句话讲一件事 + 用具体动词

F. Vague quantifiers / abstract adverbs:
- ❌ "多次 / 大量 / 广泛 / 显著 / 较为 / 一定程度上" — 给真数字,没有就不写
- ❌ "深入地 / 系统地 / 全面地 / 高效地 / 充分地" — 抽象副词,直接删,不替换
- ❌ "目前" 单独用 → ✅ 给具体时间或当前角色

G. High-density connectives (单段超过 1 个就是 AI tell):
- ❌ 一段 5 句话出现 "因此 / 此外 / 同时 / 值得一提的是 / 不仅如此" — AI 用衔接词假装逻辑
- ✅ 自然顺序,事实自带逻辑

H. Empty opening / closing 套话:
- ❌ "本文将介绍 / 综上所述 / 总而言之 / 在 X 方面" — 永不使用
- ❌ "这体现了 X / 这表明 Y / 这反映出 Z" — 抽象总结句

SPECIFICITY DENSITY RULE (this OVERRIDES any soft word-count guidance below):
- Every sentence must carry ≥1 concrete fact: a number, a name, a date, a direct quote, a specific event, a technical decision, or a specific cause/outcome.
- If you cannot put a concrete fact in a sentence, DELETE the sentence.
- "宁短勿水" — a 3-sentence bio with facts in every sentence beats a 6-sentence bio with 2 fact-bearing sentences and 4 connective fillers.
- Word-count markers in FIELD SEMANTICS below ("~200-400 字" etc.) are UPPER BOUNDS for substantial sources, NOT targets. Hit them only when source supports it; otherwise stop earlier.

POSITIVE EXAMPLE — this is the register / density we want (bio_zh of a Master's student with 2 internships + 2 side projects):

王雪(2002 年生)是宾夕法尼亚大学系统工程方向的硕士在读生,研究方向涉及系统工程与应用机器学习。本科毕业于北京大学信息管理专业,副修统计学。

本科期间,王雪曾在中国银河证券担任量化研究实习生,开发了一套基于 Python 的策略回测框架,目前被公司三个商品期货策略团队日常使用。研究生第一个暑假,她作为访问研究实习生加入微软亚洲研究院的系统与网络组,参与合著了一篇关于分布式训练容错的 workshop 论文。

她的业余项目包括 Quanta CLI —— 一个面向散户量化爱好者的开源回测命令行工具(GitHub 约 200 星),以及 Wiki Drift —— 一个在维基百科文章悬停时显示编辑历史的 Chrome 扩展。

[Why this is good: opens with a single concrete fact (birth year + status). Each subsequent sentence introduces ONE specific action / artifact / number / institution. No abstract summary. No "致力于 / 涵盖 / 关注". No empty wrap-up. Stops where facts stop.]

NEGATIVE EXAMPLE — this is the AI-slop register to AVOID (every tell labeled):

王某是一名驻费城<TELL D: translationese>的创业者和 AI 产品工程师。他目前在某大学攻读系统工程硕士学位,同时领导某项目的开发<TELL D: translationese>——一个多模态生成式 AI 平台<TELL B+C: abstract stacking>。此前,王某在伦敦联合创办了一家零售初创公司,设计了程序化广告系统和产品策略框架<TELL B+E: stacking + parallelism>,实现了 20% 的回报率提升<TELL: no baseline>和快速的 PMF 验证<TELL D: translationese>。职业生涯早期<TELL F: vague>,他...。王某的工作涵盖端到端 AI 管道、可扩展数据基础设施、产品战略和市场拓展执行<TELL A: FATAL empty summary>。

[This single short paragraph contains 8 separate AI tells. Reading it, an HR person feels "this person is saying a lot of nothing" within 10 seconds.]

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
- tagline: English one-line italic subtitle. ≤ 12 words UPPER BOUND. Identity (specific role + specific domain), not hype. If source is thin, use ≤ 6 words.
- tagline_zh: Chinese version of tagline. ≤ 20 字 UPPER BOUND. Same identity, idiomatic phrasing. Thin source → ≤ 10 字.
- bio: third-person English prose for the bio's lead+intro section. Career arc → notable work → current focus. Wikilink to projects/schools/employers using their slugs. UPPER BOUND ~220 words for rich sources, ~80 words for thin sources. STOP where the facts stop; do not pad to reach a target.
- bio_zh: Chinese version of bio. 第三人称中文 Wikipedia 风格散文. UPPER BOUND ~400 字 for rich sources, ~150 字 for thin sources. SPECIFICITY DENSITY > 字数. 停在事实结束处。
- siteName: site brand name. Default "Workplay" if user didn't propose one.
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
- body: English Wikipedia-style article body for the standalone project page. Reference its role, dates, technical approach, outcomes — only what the source supports. Wikilink to other entities (the bio page = \`[[<homepageSlug>]]\`) where natural. UPPER BOUND ~200 words. Empty string if source is too thin to write more than the bullet description. STOP where facts stop.
- body_zh: Chinese version. Same content arc, native phrasing. UPPER BOUND ~300 字. 同样:无具体事实就留空,不要造句填充。

educations (≤ 4 most relevant — schools/universities, sorted reverse-chronological newest first):
- name: institution name in English (e.g. "University of Pennsylvania").
- name_zh: Chinese name (e.g. "宾夕法尼亚大学"). Empty if source doesn't have one.
- slug: Title_Case_With_Underscores (e.g. "University_of_Pennsylvania"). Drop "The".
- degree: full degree name in English (e.g. "Master of Science in Systems Engineering"). Empty if not mentioned.
- degree_zh: Chinese mirror.
- date_range: e.g. "August 2025 – August 2027 (expected)" or "2021–2025".
- location: city/country (e.g. "Philadelphia, Pennsylvania, U.S.").
- body: English Wikipedia-style article body for the standalone school page. Coursework focus, scholarships, notable details from source. UPPER BOUND ~150 words. Empty if source is thin. STOP where facts stop.
- body_zh: Chinese mirror. UPPER BOUND ~250 字. Empty if source is thin.

experiences (≤ 5 most relevant — paid roles / internships, reverse-chronological):
- name: employer name in English (e.g. "China Galaxy Securities").
- name_zh: Chinese name if source has one (e.g. "中国银河证券"). Empty otherwise.
- slug: Title_Case_With_Underscores (e.g. "China_Galaxy_Securities").
- role: job title in English (e.g. "Quantitative Research Intern").
- role_zh: Chinese mirror.
- date_range: e.g. "Summer 2024" or "June 2024 – August 2024".
- location: city/country.
- body: English Wikipedia-style article body. Responsibilities + outcomes — only specific ones from source. UPPER BOUND ~150 words. Empty if source thin. STOP where facts stop.
- body_zh: Chinese mirror. UPPER BOUND ~250 字. Empty if source thin.

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
        description: 'Site brand name. Default "Workplay" if user did not propose one.',
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
- Body fields: UPPER BOUND ~200 words en / ~300 字 zh. STOP where facts stop, do not pad. Bilingual must be paired (fill both or neither).
- Use [[Slug]] wikilinks ONLY to slugs in the provided sibling list.

ANTI AI-VOICE TELLS (same rules as parse — read this carefully before writing):
- NEVER write empty-summary endings: ❌ "X 的工作涵盖 A、B、C、D" / "X's work spans A, B, C and D" / "X 致力于 / 专注于 [abstract]" / "with a focus on / with expertise in" — these destroy HR-reader trust. END on a specific fact or just STOP.
- NEVER stack abstract nouns: ❌ "端到端 X、可扩展 Y、产品战略" / "多模态生成式 AI 平台". Use specific verbs + specific objects.
- NEVER use translationese: ❌ "驻 X" → "现居 X"; ❌ "领导 X 的开发" → "正在开发 X"; ❌ "技术基础来自 X" → "本科就读于 X".
- NEVER use vague quantifiers ("多次/大量/广泛/显著") or abstract adverbs ("深入地/系统地/全面地") — give real numbers or skip.
- NEVER report percentages without baseline: ❌ "提升了 20%" → ✅ "从 1.6 升至 1.9" or just absolute.
- "AI" as a factual user descriptor is OK ("AI 产品工程师" if that's their title). BANNED: "AI 帮你 X" marketing tone, "AI-driven / AI-enabled" empty modifiers, abstract category stacking like "多模态生成式 AI 平台".
- SPECIFICITY DENSITY: every sentence must carry ≥1 concrete fact (number/name/date/event/technical decision). If you cannot put a fact in a sentence, DELETE the sentence.
- "宁短勿水": prefer a short body with facts in every sentence over a long body with filler.

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
