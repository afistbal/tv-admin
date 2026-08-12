export type AdminUserRow = {
  id: number;
  unique_id?: string;
  email?: string;
  anonymous?: number;
  /** 是否可看全部：0=否，1=是 */
  is_tui?: number | string | null;
  vip?: number;
  admin?: number;
  /** 注册/访问来源，如渠道码、域名、IP */
  source?: string;
  /** 来源参数 */
  from_source?: string;
  /** 剩余金币 */
  balance?: number;
  created_at?: string | null;
  login_at?: string | null;
  avatar?: string;
  [key: string]: unknown;
};
