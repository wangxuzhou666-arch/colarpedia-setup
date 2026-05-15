export function stripWikilinks(text) {
  if (!text) return "";
  return text.replace(/\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g, (_m, slug, display) => {
    if (display) return display;
    return slug.replace(/_/g, " ");
  });
}

export function countWikilinks(text) {
  if (!text) return 0;
  return (text.match(/\[\[[^\]]+\]\]/g) || []).length;
}
