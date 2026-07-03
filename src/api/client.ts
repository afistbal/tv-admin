import { getAuthToken } from "./authToken";
import { getApiBaseURL } from "./baseURL";
import type { ApiResult } from "./types";

/** 从接口 JSON 取可读错误（兼容 slot 的 `m` 与 Laravel 的 `message`） */
export function getApiErrorMessage(res: unknown, fallback = "操作失败"): string {
  if (res == null || typeof res !== "object") {
    return fallback;
  }
  const o = res as Record<string, unknown>;
  if (typeof o.m === "string" && o.m.trim()) {
    return o.m.trim();
  }
  if (typeof o.message === "string" && o.message.trim()) {
    return o.message.trim();
  }
  return fallback;
}

/** 与 slot 约定一致：`c === 0` 为成功；无 `c` 字段视为失败 */
export function isApiResultOk(res: unknown): boolean {
  return typeof res === "object" && res != null && (res as { c?: unknown }).c === 0;
}

function clientHeaders(): Record<string, string> {
  return {
    Accept: "application/json",
    "Accept-Language": localStorage.getItem("locale") ?? "zh-CN",
    Authorization: `Bearer ${getAuthToken()}`,
    "X-Platform": "web",
    "X-OS": "unknown",
    "X-Test": localStorage.getItem("test") ?? "",
    "X-Source": localStorage.getItem("source") ?? "",
  };
}

export function buildUrl(path: string, query?: Record<string, string>): string {
  const base = `${getApiBaseURL()}${path.replace(/^\//, "")}`;
  if (!query || Object.keys(query).length === 0) {
    return base;
  }
  const q = new URLSearchParams(query).toString();
  return q ? `${base}?${q}` : base;
}

/** GET 无法传 JSON 数组：`daterange` 传二元组时展开为 `daterange[0]`、`daterange[1]`（与常见 PHP/Laravel 接收方式一致） */
export type ApiGetQueryValue = string | number | undefined | readonly [string, string];

export function buildQueryString(query: Record<string, ApiGetQueryValue>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === "") {
      continue;
    }
    if (k === "daterange" && Array.isArray(v) && v.length === 2) {
      out["daterange[0]"] = String(v[0]);
      out["daterange[1]"] = String(v[1]);
      continue;
    }
    out[k] = String(v);
  }
  return out;
}

export async function apiGet<T>(path: string, query?: Record<string, ApiGetQueryValue>): Promise<ApiResult<T>> {
  const res = await fetch(buildUrl(path, query ? buildQueryString(query) : undefined), {
    method: "GET",
    headers: clientHeaders(),
  });
  return (await res.json()) as ApiResult<T>;
}

export async function apiPostJson<T>(path: string, data: Record<string, unknown>): Promise<ApiResult<T>> {
  const url = buildUrl(path);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...clientHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return (await res.json()) as ApiResult<T>;
}
