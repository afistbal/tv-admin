/**
 * C 端站点根（活动日志页 `/z/page/user-activity/...` 等）。
 * 默认 `https://yogoshort.com`，与线上活动页一致；可用环境变量覆盖。
 */
export function publicWebOrigin(): string {
  const raw = import.meta.env.VITE_PUBLIC_WEB_ORIGIN?.trim();
  if (raw) {
    return raw.replace(/\/+$/, "");
  }
  return "https://yogoshort.com";
}
