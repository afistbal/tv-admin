/** `GET admin/user/stat?id=` 返回体（与 slot ActivityLog 一致） */
export type AdminUserStatRow = {
  id?: number;
  action?: string;
  target?: string | number;
  movie_id?: string | number;
  episode_desc?: string;
  source?: string;
  ip?: string;
  country?: string;
  remark?: string;
  created_at?: string;
  [key: string]: unknown;
};

export type AdminUserStatPayload = {
  count: number;
  data: AdminUserStatRow[];
};
