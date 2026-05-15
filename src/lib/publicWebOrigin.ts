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

/** 播放页等分享链接：主域 `yogoshort.com` 统一为 `www.yogoshort.com` */
export function publicWebOriginForVideo(): string {
  const o = publicWebOrigin();
  try {
    const u = new URL(o);
    if (u.hostname === "yogoshort.com") {
      u.hostname = "www.yogoshort.com";
      return u.origin;
    }
  } catch {
    /* ignore */
  }
  return o;
}
