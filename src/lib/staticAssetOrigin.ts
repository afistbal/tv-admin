/**
 * 拼接影片封面等地址：`staticBase` + `/` + `image`（如 `xxx.webp`）。
 * `staticBase` 优先使用登录后 `GET config` 返回的 `d.static`，其次环境变量 `VITE_STATIC_ASSET_ORIGIN`。
 */
export function resolveStaticBase(runtimeFromConfig?: string | null): string {
  const fromApi = runtimeFromConfig?.trim();
  if (fromApi) {
    return fromApi.replace(/\/+$/, "");
  }
  const env = import.meta.env.VITE_STATIC_ASSET_ORIGIN?.trim();
  return env ? env.replace(/\/+$/, "") : "";
}

export function moviePosterUrl(
  image: string | null | undefined,
  runtimeStaticBase?: string | null,
): string | null {
  const img = String(image ?? "").trim();
  if (!img) {
    return null;
  }
  if (/^https?:\/\//i.test(img)) {
    return img;
  }
  const base = resolveStaticBase(runtimeStaticBase);
  if (!base) {
    return null;
  }
  return `${base}/${img.replace(/^\//, "")}`;
}
