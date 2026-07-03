export type AdminSiteKey = "main" | "prod1";

export type AdminSiteConfig = {
  key: AdminSiteKey;
  label: string;
  apiBaseURL: string;
  publicWebOrigin: string;
};

const ACTIVE_SITE_KEY = "admin-site";

function normalizeApiBase(raw: string): string {
  return raw.replace(/\/+$/, "") + "/";
}

function normalizeOrigin(raw: string): string {
  return raw.replace(/\/+$/, "");
}

const defaultPublicOrigin =
  import.meta.env.VITE_APP_FLAG === "dev" ? "https://testwww.yogoshort.com" : "https://yogoshort.com";

export const ADMIN_SITES: AdminSiteConfig[] = [
  {
    key: "main",
    label: import.meta.env.VITE_SITE_MAIN_LABEL?.trim() || "主站",
    apiBaseURL: normalizeApiBase(
      import.meta.env.VITE_SITE_MAIN_API_BASE_URL?.trim() ||
        import.meta.env.VITE_API_BASE_URL?.trim() ||
        "https://i.yogoshort.com/api",
    ),
    publicWebOrigin: normalizeOrigin(
      import.meta.env.VITE_SITE_MAIN_PUBLIC_WEB_ORIGIN?.trim() ||
        import.meta.env.VITE_PUBLIC_WEB_ORIGIN?.trim() ||
        defaultPublicOrigin,
    ),
  },
  {
    key: "prod1",
    label: import.meta.env.VITE_SITE_PROD1_LABEL?.trim() || "分站1",
    apiBaseURL: normalizeApiBase(
      import.meta.env.VITE_SITE_PROD1_API_BASE_URL?.trim() || "https://i.soulshort.com/api",
    ),
    publicWebOrigin: normalizeOrigin(
      import.meta.env.VITE_SITE_PROD1_PUBLIC_WEB_ORIGIN?.trim() || "https://www.soulshort.com",
    ),
  },
];

export function getActiveSiteKey(): AdminSiteKey {
  const raw = localStorage.getItem(ACTIVE_SITE_KEY);
  return raw === "prod1" ? "prod1" : "main";
}

export function getActiveAdminSite(): AdminSiteConfig {
  const key = getActiveSiteKey();
  return ADMIN_SITES.find((site) => site.key === key) ?? ADMIN_SITES[0];
}

export function setActiveSiteKey(key: AdminSiteKey): void {
  localStorage.setItem(ACTIVE_SITE_KEY, key);
}

export function getApiBaseURL(): string {
  return getActiveAdminSite().apiBaseURL;
}

/** 与 slot_old `src/api/baseURL.ts` 一致：prefix 以 `/` 结尾 */
export const apiBaseURL = getApiBaseURL();
