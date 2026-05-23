import type { AdminSourceRow } from "@/types/adminSourceList";

/** 接口 `d` 直接为列表数组 */
export function rowsFromSourceListPayload(d: unknown): AdminSourceRow[] {
  if (Array.isArray(d)) {
    return d as AdminSourceRow[];
  }
  if (d != null && typeof d === "object" && Array.isArray((d as { data: unknown }).data)) {
    return (d as { data: AdminSourceRow[] }).data;
  }
  return [];
}
