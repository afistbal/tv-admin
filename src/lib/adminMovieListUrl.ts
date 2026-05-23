/** HashRouter 内剧集列表路径（带 id 筛选） */
export function adminMovieListPath(id: string | number): string {
  return `/drama/movies?id=${encodeURIComponent(String(id))}`;
}

/** 可复制、分享的完整后台链接 */
export function adminMovieListAbsoluteUrl(id: string | number): string {
  const path = adminMovieListPath(id);
  const base = import.meta.env.BASE_URL || "/";
  const prefix = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${window.location.origin}${prefix}#${path}`;
}
