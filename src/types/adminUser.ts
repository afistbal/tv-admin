import type { AdminUserRow } from "./adminUserRow";

export type AdminUserListPayload = {
  data: AdminUserRow[];
  current_page: number;
  per_page: number;
  count: number;
};

export type { AdminUserRow };
