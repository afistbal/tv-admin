export type UserInfo = {
  name?: string;
  unique_id?: string;
  uid?: number;
  admin?: number;
  email?: string;
  vip?: number;
  anonymous?: number;
  is_vip?: boolean;
  [key: string]: unknown;
};

/** 与 slot_old `refreshSessionFromStoredToken`：`d.info` 或扁平 `d` */
export function normalizeLoginUser(d: Record<string, unknown>): UserInfo {
  const nested = d.info as Record<string, unknown> | undefined;
  return (nested ?? d) as UserInfo;
}

export function isAdminUser(info: UserInfo): boolean {
  return Number(info.admin) === 1;
}
