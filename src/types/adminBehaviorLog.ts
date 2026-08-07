export type AdminBehaviorLogRow = Record<string, unknown>;

export type AdminBehaviorLogListPayload = {
  data?: AdminBehaviorLogRow[];
  rows?: AdminBehaviorLogRow[];
  list?: AdminBehaviorLogRow[];
  current_page?: number;
  per_page?: number;
  count?: number;
  total?: number;
};
