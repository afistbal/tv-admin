import { getAuthToken } from "./authToken";
import { buildUrl } from "./client";
import type { ApiResult } from "./types";

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

/** 专用于会话恢复：区分「服务端明确失败」与「网络/非 JSON」 */
export type LoginTokenFetchOutcome =
  | { kind: "ok"; result: ApiResult<Record<string, unknown>> }
  | { kind: "network" }
  | { kind: "bad_response" }
  | { kind: "aborted" };

export async function fetchLoginTokenOutcome(token: string, signal?: AbortSignal): Promise<LoginTokenFetchOutcome> {
  const url = buildUrl("login/token");
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        ...clientHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
      signal,
    });
    const text = await res.text();
    try {
      const result = JSON.parse(text) as ApiResult<Record<string, unknown>>;
      return { kind: "ok", result };
    } catch {
      return { kind: "bad_response" };
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return { kind: "aborted" };
    }
    return { kind: "network" };
  }
}
