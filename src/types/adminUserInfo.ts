/** `GET admin/user/info?id=` 返回体（与 slot 后台一致字段为主） */
export type AdminUserInfo = {
  id: number;
  unique_id?: string;
  email?: string;
  anonymous?: number;
  vip?: number;
  admin?: number;
  /** 注册/访问来源 */
  source?: string;
  /** 剩余金币 */
  balance?: number;
  created_at?: string | null;
  login_at?: string | null;
  active_at?: string | null;
  alive_time?: number;
  avatar?: string;
  [key: string]: unknown;
};
