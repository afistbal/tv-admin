export type AdminPoolMovie = {
  id: number;
  title?: string;
  image?: string;
  level?: string;
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
