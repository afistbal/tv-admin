import type { AdminTagAreaRow } from "@/types/adminMovie";

/** 界面展示与 publish 接口 `tags[]` 均使用 `unique_id`（无则回退 `name`） */
export function tagDisplayLabel(row: AdminTagAreaRow): string {
  const uid = row.unique_id?.trim();
  if (uid) {
    return uid;
  }
  return row.name;
}

export function tagValuesForSelectedIds(tags: AdminTagAreaRow[], selectedIds: number[]): string[] {
  const byId = new Map(tags.map((t) => [t.id, t]));
  const out: string[] = [];
  for (const id of selectedIds) {
    const row = byId.get(id);
    if (row) {
      const v = tagDisplayLabel(row);
      if (v) {
        out.push(v);
      }
    }
  }
  return out;
}

/** 解析 `GET admin/tag` 列表 */
export function parseAdminTagRows(raw: unknown): AdminTagAreaRow[] {
  const list: unknown[] = Array.isArray(raw)
    ? raw
    : raw != null && typeof raw === "object" && "data" in raw && Array.isArray((raw as { data: unknown }).data)
      ? (raw as { data: unknown[] }).data
      : raw != null && typeof raw === "object" && "list" in raw && Array.isArray((raw as { list: unknown }).list)
        ? (raw as { list: unknown[] }).list
        : [];
  const out: AdminTagAreaRow[] = [];
  for (const row of list) {
    if (row == null || typeof row !== "object") {
      continue;
    }
    const o = row as Record<string, unknown>;
    const id = Number(o.id ?? o.ID);
    const name = String(o.name ?? o.title ?? o.label ?? "").trim();
    const unique_id = String(o.unique_id ?? "").trim() || undefined;
    if (Number.isFinite(id) && (name || unique_id)) {
      out.push({ id, name: name || unique_id!, unique_id });
    }
  }
  return out;
}
