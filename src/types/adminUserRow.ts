export type AdminUserRow = {
  id: number;
  unique_id?: string;
  email?: string;
  anonymous?: number;
  vip?: number;
  admin?: number;
  created_at?: string | null;
  login_at?: string | null;
  avatar?: string;
  [key: string]: unknown;
};
