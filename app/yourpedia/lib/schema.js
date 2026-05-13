// Form schema. Sprint 1: multi-page wiki generation.
//
// Required: name, homepageSlug, siteName.
// Everything else optional — LLM fills, user edits, manual-fill flow
// works with just the required three.

import { z } from "zod";

const slugRegex = /^[A-Z][A-Za-z0-9_]*$/;

// Helper: optional slug — empty allowed, otherwise must match pattern.
const optionalSlug = z
  .string()
  .regex(slugRegex, "Title_Case_With_Underscores (e.g. KitchenSurvivor)")
  .optional()
  .or(z.literal(""));

const optionalString = z.string().optional().or(z.literal(""));
const optionalStringArray = z.array(z.string()).optional().default([]);

// 每个项目最多 3 条产出（论文 / essay / demo / repo / blog 等外链）。
// label 和 url 都允许空字符串——空行不报错，渲染层过滤掉。
// 真正的 URL 合法性校验在 templates.js 的 safeHttpUrl 里做。
const outputItem = z.object({
  label: optionalString,
  url: optionalString,
});

const shippedItem = z.object({
  name: z.string().min(1, "Required"),
  name_zh: optionalString,
  slug: optionalSlug,
  description: optionalString,
  description_zh: optionalString,
  role: optionalString,
  role_zh: optionalString,
  date_range: optionalString,
  url: optionalString,
  tech_stack: optionalStringArray,
  outputs: z.array(outputItem).max(3, "每个项目最多 3 条产出").optional().default([]),
  body: optionalString,
  body_zh: optionalString,
});

const educationItem = z.object({
  name: z.string().min(1, "Required"),
  name_zh: optionalString,
  slug: optionalSlug,
  degree: optionalString,
  degree_zh: optionalString,
  date_range: optionalString,
  location: optionalString,
  body: optionalString,
  body_zh: optionalString,
});

const experienceItem = z.object({
  name: z.string().min(1, "Required"),
  name_zh: optionalString,
  slug: optionalSlug,
  role: optionalString,
  role_zh: optionalString,
  date_range: optionalString,
  location: optionalString,
  outputs: z.array(outputItem).max(3, "每段工作经历最多 3 条产出").optional().default([]),
  body: optionalString,
  body_zh: optionalString,
});

export const setupSchema = z.object({
  // Identity (required)
  name: z.string().min(1, "Required"),
  name_zh: optionalString,
  homepageSlug: z
    .string()
    .min(1, "Required")
    .regex(slugRegex, "Title_Case_With_Underscores (e.g. Jane_Doe)"),
  tagline: optionalString,
  tagline_zh: optionalString,
  bio: optionalString,
  bio_zh: optionalString,

  // Site (required)
  siteName: z.string().min(1, "Required").default("Workplay"),

  // Meta (advanced, all optional — relaxed in Phase 1B v2)
  metaBaseUrl: optionalString,
  githubOwner: optionalString,
  githubRepo: optionalString,

  // Contact (all optional)
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  linkedin: optionalString,
  githubProfile: optionalString,

  // Multi-entity arrays (Sprint 1)
  shipped: z.array(shippedItem).default([]),
  educations: z.array(educationItem).default([]),
  experiences: z.array(experienceItem).default([]),
});

export function deriveSlug(name) {
  if (!name) return "";
  return name
    .trim()
    .replace(/[^\w\s-]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("_");
}
