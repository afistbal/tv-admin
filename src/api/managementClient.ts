const MANAGEMENT_API_BASE_URL = (
  import.meta.env.VITE_MANAGEMENT_API_BASE_URL?.trim() || "https://t.qxbyw.com"
).replace(/\/+$/, "");

const MANAGEMENT_TOKEN_KEY = "tv-admin-management-token";

export type ManagementApiResult<T> = {
  code: string | number;
  message?: string;
  data: T;
};

export function getManagementToken(): string {
  try {
    return localStorage.getItem(MANAGEMENT_TOKEN_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function setManagementToken(token: string): void {
  localStorage.setItem(MANAGEMENT_TOKEN_KEY, token);
}

export function clearManagementToken(): void {
  localStorage.removeItem(MANAGEMENT_TOKEN_KEY);
}

export function isManagementApiSuccess(code: unknown): boolean {
  return Number(code) === 0 || Number(code) === 200;
}

export async function managementPost<T>(
  path: string,
  data: Record<string, unknown>,
  options: { authenticated?: boolean } = {},
): Promise<ManagementApiResult<T>> {
  const authenticated = options.authenticated !== false;
  const token = getManagementToken();
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (authenticated && token) {
    // 与 D:\JJ\lot.www 保持一致：直接传 token，不加 Bearer 前缀。
    headers.authorization = token;
  }

  const response = await fetch(`${MANAGEMENT_API_BASE_URL}/${path.replace(/^\/+/, "")}`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error(response.ok ? "接口未返回 JSON" : `请求失败（HTTP ${response.status}）`);
  }
  return (await response.json()) as ManagementApiResult<T>;
}
