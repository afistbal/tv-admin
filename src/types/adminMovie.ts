export type AdminMovieRow = {
  id: number;
  title?: string;
  image?: string;
  sort?: number;
  audio_track?: string;
  /** 与 slot 一致：`1` 上架、`2` 下架、`3` 已删除 */
  status?: number;
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

/** `GET admin/movie?id=` 与 slot_old `MovieDetail` 一致 */
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
  vip?: number;
  subtitle?: { id?: number; url?: string } | null;
  [key: string]: unknown;
};

export type AdminTagAreaRow = {
  id: number;
  name: string;
};
