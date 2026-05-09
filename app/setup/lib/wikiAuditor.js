// Heuristic completeness auditor for wiki form data.
//
// Runs entirely in the browser — zero LLM calls, zero tokens spent.
// Generates "💡 you could improve this by …" suggestions to surface in
// PreviewModal so the user knows what's still thin before they ship.
//
// Designed to be replaced/augmented later by a local small-model layer
// — keep the input shape (form data) and output shape (Suggestion[])
// stable so the upgrade is drop-in.

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

function countWikilinks(s) {
  if (!s) return 0;
  return (String(s).match(WIKILINK_RE) || []).length;
}

// Suggestion shape: { severity, message, action, fixField?, canPolish? }
//   severity:  "info" | "tip" | "warn"
//   message:   user-visible text
//   action:    "fix-field" | "expand-row" | "upload" | "edit-bio"
//   fixField:  { section: "identity" | "shipped" | "educations" | "experiences",
//                idx?: number, field: string }
//   canPolish: true  → suggestion eligible for /api/polish-entity gap-fill
//                       (per-entity textual fields the LLM can extract from
//                        a fresh PDF / pasted source)
//              false → user has to fix in the form directly (photo upload,
//                       contact URL, structural decisions like bio wikilinks)
//
// canPolish is a small flag the PreviewModal reads to decide whether to
// show "+ Add material" next to a suggestion. Adding the flag here (vs
// recomputing in the modal) keeps the rule centralised: the auditor
// owns "what's missing AND what the LLM can plausibly fix".

const POLISHABLE_FIELDS = new Set([
  "body",
  "body_zh",
  "role",
  "role_zh",
  "degree",
  "degree_zh",
  "date_range",
  "location",
  "url",
  "tech_stack",
]);

function isPolishable(fixField) {
  if (!fixField) return false;
  if (fixField.section === "identity") return false; // identity gaps go to form
  if (fixField.idx === undefined) return false;
  return POLISHABLE_FIELDS.has(fixField.field);
}

export function auditWikiData(data, files = {}) {
  const out = [];
  const shipped = (data.shipped || []).filter((s) => s.name);
  const educations = (data.educations || []).filter((e) => e.name);
  const experiences = (data.experiences || []).filter((e) => e.name);

  // ---- 1. Photo ----
  if (!files.photoFile) {
    out.push({
      severity: "tip",
      message:
        "Upload a portrait photo — the bio infobox currently shows a placeholder.",
      action: "upload",
    });
  }

  // ---- 2. Contact links ----
  if (!data.linkedin && !data.githubProfile && !data.email) {
    out.push({
      severity: "warn",
      message:
        "No contact info on file. At least one of email / LinkedIn / GitHub is recommended for a HR-readable wiki.",
      action: "fix-field",
      fixField: { section: "identity", field: "linkedin" },
    });
  } else {
    if (!data.linkedin) {
      out.push({
        severity: "tip",
        message: "LinkedIn URL missing — add it for credibility.",
        action: "fix-field",
        fixField: { section: "identity", field: "linkedin" },
      });
    }
    if (!data.githubProfile && (shipped.length > 0)) {
      out.push({
        severity: "tip",
        message:
          "Projects listed but no GitHub profile — readers expect a GitHub link when you ship code.",
        action: "fix-field",
        fixField: { section: "identity", field: "githubProfile" },
      });
    }
  }

  // ---- 3. Bio cross-link density ----
  // Wikipedia-style bios link to schools / employers / projects naturally.
  // Rule: if bio body has < 50% of (entity count) wikilinks, flag.
  const totalEntities = shipped.length + educations.length + experiences.length;
  if (data.bio && totalEntities > 0) {
    const linkCount = countWikilinks(data.bio);
    const ratio = linkCount / totalEntities;
    if (ratio < 0.4) {
      out.push({
        severity: "tip",
        message: `Bio links to ${linkCount} of ${totalEntities} entities. A Wikipedia-style bio normally cross-links most schools / employers / projects via [[Slug]] syntax.`,
        action: "edit-bio",
        fixField: { section: "identity", field: "bio" },
      });
    }
  }

  // ---- 4. Per-entity completeness ----
  shipped.forEach((p, idx) => {
    if (!p.body) {
      out.push({
        severity: "tip",
        message: `Project "${p.name}" has no body text — its standalone wiki page will be a stub. Add a 1-2 paragraph description.`,
        action: "expand-row",
        fixField: { section: "shipped", idx, field: "body" },
      });
    }
    if (!p.role) {
      out.push({
        severity: "info",
        message: `Project "${p.name}" missing role (e.g. "Founder", "Lead Engineer").`,
        action: "expand-row",
        fixField: { section: "shipped", idx, field: "role" },
      });
    }
    if (!p.date_range) {
      out.push({
        severity: "info",
        message: `Project "${p.name}" missing date range.`,
        action: "expand-row",
        fixField: { section: "shipped", idx, field: "date_range" },
      });
    }
    if (!p.url) {
      out.push({
        severity: "info",
        message: `Project "${p.name}" has no public URL — link to App Store / GitHub / live demo if any.`,
        action: "expand-row",
        fixField: { section: "shipped", idx, field: "url" },
      });
    }
  });

  educations.forEach((e, idx) => {
    if (!e.body) {
      out.push({
        severity: "tip",
        message: `Education "${e.name}" has no body — its page will be a stub.`,
        action: "expand-row",
        fixField: { section: "educations", idx, field: "body" },
      });
    }
    if (!e.degree) {
      out.push({
        severity: "info",
        message: `Education "${e.name}" missing degree.`,
        action: "expand-row",
        fixField: { section: "educations", idx, field: "degree" },
      });
    }
    if (!e.date_range) {
      out.push({
        severity: "info",
        message: `Education "${e.name}" missing dates.`,
        action: "expand-row",
        fixField: { section: "educations", idx, field: "date_range" },
      });
    }
  });

  experiences.forEach((e, idx) => {
    if (!e.body) {
      out.push({
        severity: "tip",
        message: `Experience "${e.name}" has no body — its page will be a stub.`,
        action: "expand-row",
        fixField: { section: "experiences", idx, field: "body" },
      });
    }
    if (!e.role) {
      out.push({
        severity: "info",
        message: `Experience "${e.name}" missing role / job title.`,
        action: "expand-row",
        fixField: { section: "experiences", idx, field: "role" },
      });
    }
    if (!e.date_range) {
      out.push({
        severity: "info",
        message: `Experience "${e.name}" missing dates.`,
        action: "expand-row",
        fixField: { section: "experiences", idx, field: "date_range" },
      });
    }
  });

  // ---- 5. Empty-payload sanity ----
  if (totalEntities === 0) {
    out.push({
      severity: "warn",
      message:
        "No projects / education / experience entries yet. Add at least one to get a wiki worth linking — otherwise it's just the bio page alone.",
      action: "fix-field",
      fixField: { section: "shipped", field: "name" },
    });
  }

  // ---- 6. Bilingual presence (zh) ----
  const hasZh =
    !!(data.bio_zh || data.tagline_zh || data.name_zh) ||
    shipped.some((s) => s.description_zh || s.body_zh);
  if (!hasZh && totalEntities > 0) {
    out.push({
      severity: "info",
      message:
        "No Chinese version detected — your wiki will only have an English route. Add Chinese fields if you want /zh/ to render.",
      action: "fix-field",
      fixField: { section: "identity", field: "bio_zh" },
    });
  }

  // Decorate each suggestion with canPolish based on its fixField shape.
  return out.map((s) => ({ ...s, canPolish: isPolishable(s.fixField) }));
}

// Group suggestions for clean rendering: warns first, tips, infos last.
export function groupSuggestions(suggestions) {
  const buckets = { warn: [], tip: [], info: [] };
  for (const s of suggestions) {
    buckets[s.severity || "info"].push(s);
  }
  return buckets;
}
