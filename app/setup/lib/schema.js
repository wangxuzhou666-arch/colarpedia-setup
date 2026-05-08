// Phase 1A form schema. Intentionally lenient — 5h MVP, not over-validate.
// Required: name, homepageSlug, metaBaseUrl, githubOwner, githubRepo.
// Everything else optional.

import { z } from "zod";

const slugRegex = /^[A-Z][A-Za-z0-9_]*$/;

export const setupSchema = z.object({
  // Identity
  name: z.string().min(1, "Required"),
  homepageSlug: z
    .string()
    .min(1, "Required")
    .regex(slugRegex, "Title_Case_With_Underscores (e.g. Jane_Doe)"),
  tagline: z.string().optional().or(z.literal("")),
  bio: z.string().optional().or(z.literal("")),

  // Site
  siteName: z.string().min(1, "Required").default("Yourpedia"),

  // Meta
  metaBaseUrl: z
    .string()
    .url("Must be a valid URL (e.g. https://your-site.vercel.app)"),

  // GitHub
  githubOwner: z.string().min(1, "Required"),
  githubRepo: z.string().min(1, "Required"),

  // Contact (all optional)
  email: z
    .string()
    .email("Invalid email")
    .optional()
    .or(z.literal("")),
  linkedin: z.string().url("Must be a full URL").optional().or(z.literal("")),
  githubProfile: z
    .string()
    .url("Must be a full URL")
    .optional()
    .or(z.literal("")),

  // Shipped (Phase 1A: stored but only listed in bio, not separate pages)
  shipped: z
    .array(
      z.object({
        name: z.string().min(1, "Required"),
        description: z.string().optional().or(z.literal("")),
      })
    )
    .default([]),
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
