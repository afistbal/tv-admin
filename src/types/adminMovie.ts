export type AdminMovieRow = {
  id: number;
  title?: string;
  image?: string;
  /** 剧表：无水印标记，`1` 时封面走 `movieCoverUrl` → `movie_images/{id}.webp` */
  is_rename?: number | string;
  sort?: number;
  audio_track?: string;
  /** `0` 草稿、`1` 上架、`2` 下架、`3` 已删除 */
  status?: number;
  /** `0` 自动拉取、`1` 手动上传（original） */
  source?: number;
  /** 列表里常见为标签 id 数组，与详情 `tag` 一致 */
  tag?: number[];
  level?: string;
  play?: number;
  play_7days?: number;
  views_7d?: number;
  favorites?: number;
  [key: string]: unknown;
};

export type AdminMovieListPayload = {
  data: AdminMovieRow[];
  current_page: number;
  per_page: number;
  count: number;
};

/** `GET admin/movie?id=`；封面与 `is_rename` 在 `info`（剧表） */
export type AdminMovieDetailPayload = {
  info: Record<string, unknown>;
  episodes: AdminMovieEpisodeRow[];
  tag: number[];
  area: number[];
};

export type AdminMovieEpisodeRow = {
  id?: number;
  episode?: number;
  video?: string;
  /** 手动上传分集原始文件名 */
  alias_name?: string;
  /** 字幕文件路径（常为 .vtt），与 `video` 同级 */
  url?: string;
  vip?: number;
  subtitle?: { id?: number; url?: string } | null;
  [key: string]: unknown;
};

export type AdminTagAreaRow = {
  id: number;
  name: string;
  /** 标签业务标识，展示与 publish 接口 `tags[]` 使用此字段 */
  unique_id?: string;
};
