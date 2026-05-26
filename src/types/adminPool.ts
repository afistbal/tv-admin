/** 推荐池列表 `GET admin/pools` 的 type 参数 */
export type AdminPoolType = "recommend" | "search_feed" | "membership";

export const ADMIN_POOL_TAB_ITEMS: { key: AdminPoolType; label: string }[] = [
  { key: "recommend", label: "推荐页配置" },
  { key: "search_feed", label: "搜索页配置" },
  { key: "membership", label: "会员页配置" },
];

export type AdminPoolMovie = {
  id: number;
  title?: string;
  image?: string;
  level?: string;
  play?: number;
  play_7days?: number;
  views_7d?: number;
  view_count_7d?: number;
  play_count_7d?: number;
  favorites?: number;
  favorite_count?: number;
  [key: string]: unknown;
};

export type AdminPoolRow = {
  id: number;
  pool_type?: string;
  movie_id: number;
  sort: number;
  effective_at?: string | null;
  expired_at?: string | null;
  created_at?: string;
  updated_at?: string;
  movie?: AdminPoolMovie;
  [key: string]: unknown;
};

export type AdminPoolListPayload = {
  data: AdminPoolRow[];
  current_page: number;
  per_page: number;
  count?: number;
};
