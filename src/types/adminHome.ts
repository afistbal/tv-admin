/** 与 slot_old `GET admin/home` 返回 `d` 对齐 */
export type AdminHomePlayRankItem = {
  count?: number;
  target?: string | number;
  title?: string;
};

export type AdminHomeAliveRankItem = {
  user_id?: string | number;
  time?: string;
};

export type AdminHomeData = {
  today_uploaded?: number;
  total_uploaded?: number;
  uv?: number;
  pv?: number;
  unlock?: number;
  play?: number;
  registered_user?: number;
  unpaid_order?: number;
  paid_order?: number;
  subscription?: number;
  total_alive_time?: string;
  average_alive_time?: string;
  play_rank?: AdminHomePlayRankItem[];
  alive_ranking?: AdminHomeAliveRankItem[];
};
