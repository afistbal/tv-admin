import { getActiveSiteKey } from "./baseURL";

const LEGACY_TOKEN_KEY = "token";

export function authTokenKeyForSite(siteKey = getActiveSiteKey()): string {
  return siteKey === "main" ? LEGACY_TOKEN_KEY : `${LEGACY_TOKEN_KEY}:${siteKey}`;
}

/** 与 slot 一致：读当前站点 localStorage token，形如 `433|IDTdA34...` */
export function getAuthToken(): string {
  return localStorage.getItem(authTokenKeyForSite())?.trim() ?? "";
}

export function setAuthToken(token: string): void {
  localStorage.setItem(authTokenKeyForSite(), token);
  if (getActiveSiteKey() === "main") {
    localStorage.setItem(LEGACY_TOKEN_KEY, token);
  }
}

export function clearAuthToken(): void {
  localStorage.removeItem(authTokenKeyForSite());
  if (getActiveSiteKey() === "main") {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  }
}
