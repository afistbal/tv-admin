/**
 * 静态资源基址：`config.d.static` 或 `VITE_STATIC_ASSET_ORIGIN`。
 */
export function resolveStaticBase(runtimeFromConfig?: string | null): string {
  const fromApi = runtimeFromConfig?.trim();
  if (fromApi) {
    return fromApi.replace(/\/+$/, "");
  }
  const env = import.meta.env.VITE_STATIC_ASSET_ORIGIN?.trim();
  return env ? env.replace(/\/+$/, "") : "";
}

/**
 * 剧表封面字段（水印标记在剧表 `is_rename`）：
 * - `GET admin/movie/list` → `d.data[n]`
 * - `GET admin/movie` → `d.info`
 * - `GET admin/movie/listnew` → `d.data[n]`
 */
export type MovieCoverSource = {
  id?: number | string;
  image?: string | null;
  is_rename?: number | string | boolean;
};

export function readMovieIsRename(record: Record<string, unknown> | undefined): boolean {
  if (!record) {
    return false;
  }
  const v = record.is_rename;
  return v === 1 || v === "1" || v === true;
}

/** 将 list 行 / 详情 info 等 API 对象规范为封面源 */
export function normalizeMovieCoverSource(
  record: Record<string, unknown> | MovieCoverSource | null | undefined,
  fallbackId?: number,
): MovieCoverSource | null {
  if (record == null || typeof record !== "object") {
    return null;
  }
  const r = record as Record<string, unknown>;
  const idRaw = r.id ?? fallbackId;
  const id = Number(idRaw);
  const resolvedId = Number.isFinite(id) && id > 0 ? id : fallbackId;
  if (resolvedId == null || !Number.isFinite(resolvedId) || resolvedId <= 0) {
    return null;
  }
  return {
    id: resolvedId,
    image: r.image != null ? String(r.image) : "",
    is_rename: r.is_rename as MovieCoverSource["is_rename"],
  };
}

/** 相对路径：`is_rename === 1` → `movie_images/{id}.webp`，否则用 `image` */
export function movieCoverImagePath(
  source: Record<string, unknown> | MovieCoverSource | null | undefined,
  options?: { fallbackId?: number },
): string {
  const row = normalizeMovieCoverSource(source, options?.fallbackId);
  if (!row) {
    return "";
  }
  if (readMovieIsRename(row as Record<string, unknown>)) {
    const id = Number(row.id);
    if (Number.isFinite(id) && id > 0) {
      return `movie_images/${id}.webp`;
    }
  }
  return String(row.image ?? "").trim();
}

/**
 * 剧表封面完整 URL（list / listnew 行对象，或详情 `info`）。
 *
 * @example
 * movieCoverUrl(row, staticBase) // admin/movie/list | listnew
 * movieCoverUrl(detail.info, staticBase, { fallbackId: movieId }) // admin/movie
 */
export function movieCoverUrl(
  source: Record<string, unknown> | MovieCoverSource | null | undefined,
  runtimeStaticBase?: string | null,
  options?: { fallbackId?: number },
): string | null {
  return staticAssetUrl(movieCoverImagePath(source, options), runtimeStaticBase);
}

/** `GET admin/movie?id=`：封面在 `d.info`（剧表） */
export function movieCoverUrlFromDetail(
  movieId: number,
  detail: { info?: Record<string, unknown> } | null | undefined,
  runtimeStaticBase?: string | null,
): string | null {
  return movieCoverUrl(detail?.info, runtimeStaticBase, { fallbackId: movieId });
}

/** 非剧表封面的静态路径拼接（分集视频路径等） */
export function staticAssetUrl(
  path: string | null | undefined,
  runtimeStaticBase?: string | null,
): string | null {
  const img = String(path ?? "").trim();
  if (!img) {
    return null;
  }
  if (/^https?:\/\//i.test(img)) {
    return img;
  }
  if (img.startsWith("//")) {
    return `https:${img}`;
  }
  const base = resolveStaticBase(runtimeStaticBase);
  if (!base) {
    return null;
  }
  const normalizedBase = base.startsWith("//") ? `https:${base}` : base;
  return `${normalizedBase}/${img.replace(/^\//, "")}`;
}

/** 水印封面相对路径：`movie_images/{id}.webp` */
export function movieWatermarkCoverPath(movieId: number): string {
  return `movie_images/${movieId}.webp`;
}

/** 水印封面完整 URL（开启 `is_rename` 后对外展示的图） */
export function movieWatermarkCoverUrl(movieId: number, runtimeStaticBase?: string | null): string | null {
  if (!Number.isFinite(movieId) || movieId <= 0) {
    return null;
  }
  return staticAssetUrl(movieWatermarkCoverPath(movieId), runtimeStaticBase);
}

/** 探测静态图片 URL 是否可加载（用于开启水印前校验 ID 图是否存在） */
export function checkImageUrlExists(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    const finish = (ok: boolean) => {
      img.onload = null;
      img.onerror = null;
      resolve(ok);
    };
    img.onload = () => finish(true);
    img.onerror = () => finish(false);
    img.src = url;
  });
}

/** @deprecated 使用 {@link staticAssetUrl} */
export const moviePosterUrl = staticAssetUrl;
