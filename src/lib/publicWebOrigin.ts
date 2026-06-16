/**
 * C 端站点根（活动日志页 `/z/page/user-activity/...` 等）。
 * 开发/测试默认 `testwww.yogoshort.com`；正式默认 `yogoshort.com`。
 */
export function publicWebOrigin(): string {
  const raw = import.meta.env.VITE_PUBLIC_WEB_ORIGIN?.trim();
  if (raw) {
    return raw.replace(/\/+$/, "");
  }
  if (import.meta.env.VITE_APP_FLAG === "dev") {
    return "https://testwww.yogoshort.com";
  }
  return "https://yogoshort.com";
}

/** 播放页等分享链接：正式主域 `yogoshort.com` 统一为 `www.yogoshort.com`；测试域保持不变 */
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
