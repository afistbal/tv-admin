export type AdminUserRow = {
  id: number;
  unique_id?: string;
  email?: string;
  anonymous?: number;
  vip?: number;
  admin?: number;
  /** 注册/访问来源，如渠道码、域名、IP */
  source?: string;
  /** 剩余金币 */
  balance?: number;
  created_at?: string | null;
  login_at?: string | null;
  avatar?: string;
  [key: string]: unknown;
};
