// 表单完整度本地启发式检查器。
// 全程在浏览器跑，不消耗 LLM 额度，输出 "你可以这样改进..." 提示放到 PreviewModal 里。

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

function countWikilinks(s) {
  if (!s) return 0;
  return (String(s).match(WIKILINK_RE) || []).length;
}

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
  if (fixField.section === "identity") return false;
  if (fixField.idx === undefined) return false;
  return POLISHABLE_FIELDS.has(fixField.field);
}

export function auditWikiData(data, files = {}) {
  const out = [];
  const shipped = (data.shipped || []).filter((s) => s.name);
  const educations = (data.educations || []).filter((e) => e.name);
  const experiences = (data.experiences || []).filter((e) => e.name);

  // 1. 头像
  if (!files.photoFile) {
    out.push({
      severity: "tip",
      message: "传一张头像吧——现在你的 wiki 信息卡里头像位置是空的。",
      action: "upload",
    });
  }

  // 2. 联系方式
  if (!data.linkedin && !data.githubProfile && !data.email) {
    out.push({
      severity: "warn",
      message: "没填任何联系方式。建议至少留邮箱、领英、GitHub 中的一个，HR 才能联系到你。",
      action: "fix-field",
      fixField: { section: "identity", field: "linkedin" },
    });
  } else {
    if (!data.linkedin) {
      out.push({
        severity: "tip",
        message: "没填领英 URL——加上能让 wiki 看起来更可信。",
        action: "fix-field",
        fixField: { section: "identity", field: "linkedin" },
      });
    }
    if (!data.githubProfile && (shipped.length > 0)) {
      out.push({
        severity: "tip",
        message: "你列了项目作品但没填 GitHub——读者一般会期待项目背后有 GitHub 链接。",
        action: "fix-field",
        fixField: { section: "identity", field: "githubProfile" },
      });
    }
  }

  // 3. 简介内的交叉链接密度
  const totalEntities = shipped.length + educations.length + experiences.length;
  if (data.bio && totalEntities > 0) {
    const linkCount = countWikilinks(data.bio);
    const ratio = linkCount / totalEntities;
    if (ratio < 0.4) {
      out.push({
        severity: "tip",
        message: `个人简介里只链接到了 ${linkCount} / ${totalEntities} 项经历。维基百科风格的 bio 通常会用 [[Slug]] 语法把大部分学校 / 公司 / 项目都链一下。`,
        action: "edit-bio",
        fixField: { section: "identity", field: "bio" },
      });
    }
  }

  // 4. 单条经历完整度
  shipped.forEach((p, idx) => {
    if (!p.body && !p.body_zh) {
      out.push({
        severity: "tip",
        message: `项目 "${p.name}" 没有详细介绍——它单独的 wiki 页面会很短。建议加 1-2 段说明。`,
        action: "expand-row",
        fixField: { section: "shipped", idx, field: "body_zh" },
      });
    }
    if (!p.role && !p.role_zh) {
      out.push({
        severity: "info",
        message: `项目 "${p.name}" 没填你担任的角色（如"主创"、"后端开发"）。`,
        action: "expand-row",
        fixField: { section: "shipped", idx, field: "role_zh" },
      });
    }
    if (!p.date_range) {
      out.push({
        severity: "info",
        message: `项目 "${p.name}" 没填时间。`,
        action: "expand-row",
        fixField: { section: "shipped", idx, field: "date_range" },
      });
    }
    if (!p.url) {
      out.push({
        severity: "info",
        message: `项目 "${p.name}" 没有公开链接——如果有 App Store / GitHub / 演示链接建议加上。`,
        action: "expand-row",
        fixField: { section: "shipped", idx, field: "url" },
      });
    }
  });

  educations.forEach((e, idx) => {
    if (!e.body && !e.body_zh) {
      out.push({
        severity: "tip",
        message: `教育经历 "${e.name}" 没有详细介绍——它的 wiki 页面会很短。`,
        action: "expand-row",
        fixField: { section: "educations", idx, field: "body_zh" },
      });
    }
    if (!e.degree && !e.degree_zh) {
      out.push({
        severity: "info",
        message: `教育经历 "${e.name}" 没填学位 / 专业。`,
        action: "expand-row",
        fixField: { section: "educations", idx, field: "degree_zh" },
      });
    }
    if (!e.date_range) {
      out.push({
        severity: "info",
        message: `教育经历 "${e.name}" 没填时间。`,
        action: "expand-row",
        fixField: { section: "educations", idx, field: "date_range" },
      });
    }
  });

  experiences.forEach((e, idx) => {
    if (!e.body && !e.body_zh) {
      out.push({
        severity: "tip",
        message: `工作经历 "${e.name}" 没有详细介绍——它的 wiki 页面会很短。`,
        action: "expand-row",
        fixField: { section: "experiences", idx, field: "body_zh" },
      });
    }
    if (!e.role && !e.role_zh) {
      out.push({
        severity: "info",
        message: `工作经历 "${e.name}" 没填职位。`,
        action: "expand-row",
        fixField: { section: "experiences", idx, field: "role_zh" },
      });
    }
    if (!e.date_range) {
      out.push({
        severity: "info",
        message: `工作经历 "${e.name}" 没填时间。`,
        action: "expand-row",
        fixField: { section: "experiences", idx, field: "date_range" },
      });
    }
  });

  // 5. 完全空的提醒
  if (totalEntities === 0) {
    out.push({
      severity: "warn",
      message: "还没填任何项目 / 教育 / 工作经历。至少加一条，wiki 才有内容可看，否则就只剩一页 bio。",
      action: "fix-field",
      fixField: { section: "shipped", field: "name" },
    });
  }

  // 6. 英文版（可选）
  const hasEn = !!(data.bio || data.tagline);
  if (!hasEn && totalEntities > 0) {
    out.push({
      severity: "info",
      message: "没填英文版内容——你的 wiki 只会有中文页面。如果想做双语版（海外 HR 可读），展开「想做英文版？」填一下。",
      action: "fix-field",
      fixField: { section: "identity", field: "bio" },
    });
  }

  return out.map((s) => ({ ...s, canPolish: isPolishable(s.fixField) }));
}

// 按严重程度分组，warn 优先 → tip → info
export function groupSuggestions(suggestions) {
  const buckets = { warn: [], tip: [], info: [] };
  for (const s of suggestions) {
    buckets[s.severity || "info"].push(s);
  }
  return buckets;
}
