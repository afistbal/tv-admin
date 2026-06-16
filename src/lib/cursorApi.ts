import { apiPostJson } from "@/api/client";
import type { ApiResult } from "@/api/types";

export type CursorSourceOption = {
  key: string;
  label: string;
};

export type CursorSaveResult = {
  path?: string;
};

function parseCursorSources(raw: unknown): CursorSourceOption[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: CursorSourceOption[] = [];
  for (const row of list) {
    if (row == null || typeof row !== "object") {
      continue;
    }
    const o = row as Record<string, unknown>;
    const key = String(o.key ?? "").trim();
    const label = String(o.label ?? key).trim();
    if (key) {
      out.push({ key, label: label || key });
    }
  }
  return out;
}

export async function fetchCursorSources(): Promise<ApiResult<CursorSourceOption[]>> {
  const res = await apiPostJson<unknown>("admin/cursor/sources", {});
  if (res.c !== 0) {
    return { ...res, d: [] };
  }
  return { ...res, d: parseCursorSources(res.d) };
}

export async function saveCursor(payload: {
  source: string;
  value: number;
}): Promise<ApiResult<CursorSaveResult>> {
  return apiPostJson<CursorSaveResult>("admin/cursor/save", {
    source: payload.source,
    value: payload.value,
  });
}
