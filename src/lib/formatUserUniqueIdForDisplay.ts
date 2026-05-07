/**
 * 与 slot_old `formatUserUniqueIdForDisplay` 一致：列表/详情展示用。
 */
export function parseCompositeUidForDisplay(composite: string): string {
  const parts = composite.split("|").map((p) => p.replace(/token$/i, "").trim());
  const nonempty = parts.filter(Boolean);
  if (nonempty.length === 0) {
    return composite.trim();
  }
  if (nonempty.length === 2) {
    return nonempty[0] ?? "";
  }
  if (nonempty.length >= 3) {
    return nonempty[nonempty.length - 1] ?? "";
  }
  return nonempty[0] ?? "";
}

export function formatUserUniqueIdForDisplay(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s || !s.includes("|")) {
    return s;
  }
  return parseCompositeUidForDisplay(s);
}
