/**
 * Placeholder resolver — substitutes {{TOKEN}} markers declared in a
 * template's `placeholders` map with matching field values from `data`.
 *
 * Mapping rules:
 *  1. {{TOKEN}} whose TOKEN lowercased matches a data key  → data[key]
 *  2. {{TOKEN}} whose TOKEN lowercased matches a section id → data[id]
 *  3. Unknown tokens are left untouched so reviewers see them.
 */

interface PlaceholderTemplate {
  placeholders?: Record<string, string>;
  sections?: Array<{ id: string }>;
}

export function resolvePlaceholders(
  template: PlaceholderTemplate,
  data: Record<string, unknown>,
  text: string,
): string {
  if (!text || !text.includes('{{')) return text;
  const sectionIds = new Set((template.sections ?? []).map(s => s.id));
  return text.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (match, rawToken: string) => {
    const token = rawToken.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(data, token)) {
      const value = data[token];
      return value == null ? match : String(value);
    }
    if (sectionIds.has(token)) {
      const value = data[token];
      return value == null ? match : String(value);
    }
    return match;
  });
}

/** Shallow map: substitute placeholders in every string field of data. */
export function resolveAllStrings(
  template: PlaceholderTemplate,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = typeof v === 'string' ? resolvePlaceholders(template, data, v) : v;
  }
  return out;
}
