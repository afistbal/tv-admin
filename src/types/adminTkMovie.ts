export type AdminTkMovieRow = {
  id: number;
  movie_id: number;
  status: number;
  title?: string;
  tiktok_title?: string;
  tiktok_language?: number;
  tiktok_year?: number;
  tiktok_description?: string;
  tiktok_drama_type?: number;
  tiktok_tag_list?: number[];
  image?: string;
  episode_count?: number;
  byteplus_episode_count?: number | string;
  publish_status?: number;
  is_recommend?: number;
  sort?: number;
  tiktok_album_id?: string | null;
  tiktok_version?: number;
  tiktok_online_version?: number;
  tiktok_review_status?: number;
  tiktok_publish_status?: number;
  audit_remark?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

export type AdminTkMovieListPayload = {
  data: AdminTkMovieRow[];
  current_page?: number;
  per_page?: number;
  page?: number;
  pageSize?: number;
  from?: number | null;
  to?: number | null;
  next_page_url?: string | null;
  prev_page_url?: string | null;
  /** 兼容旧版接口，新版 simplePaginate 不再返回 */
  count?: number;
  total?: number;
};

export type AdminTkDictionaryItem = {
  value: number;
  label: string;
  code: string;
};

export type AdminTkMovieEpisodeRow = {
  id: number;
  movie_id?: number;
  episode?: number;
  image?: string;
  vip?: number;
  unlock_coins?: number;
  alias_name?: string;
  byteplus_vid?: string;
  tiktok_episode_id?: string | null;
  [key: string]: unknown;
};

export type AdminTkMovieDetailPayload = {
  tk_movie: AdminTkMovieRow;
  movie: Record<string, unknown>;
  episodes: AdminTkMovieEpisodeRow[];
};

export type AdminTkMovieSavePayload = {
  movie_id: number;
  title?: string;
  language?: number;
  year?: number;
  description?: string;
  drama_type?: number;
  tag_list?: number[];
};
