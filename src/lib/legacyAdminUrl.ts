/** 与当前 API 同源的站点根，用于跳转 slot 旧后台 `/z/page/...` */
export function legacyAdminOrigin(): string {
  let s = (import.meta.env.VITE_API_BASE_URL || "https://test.yogoshort.com/api").replace(/\/+$/, "");
  if (/\/api$/i.test(s)) {
    s = s.replace(/\/api$/i, "");
  }
  try {
    return new URL(s).origin;
  } catch {
    return "";
  }
}
