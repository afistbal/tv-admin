export type ForyouPositionSrc = "recommend" | "n" | "a" | "b";

export type ForyouPositionRow = {
  pos?: number;
  src: ForyouPositionSrc;
  desc?: string;
};

export type AdminForyouRow = {
  id: number;
  feed_type?: string;
  title?: string;
  page_size?: number;
  positions: ForyouPositionRow[];
  is_active?: number;
  created_at?: string;
  updated_at?: string;
};

export type AdminForyouListPayload = {
  data: AdminForyouRow[];
  current_page?: number;
  per_page?: number;
};
