export type AdminOrderRow = {
  id: number;
  user_id?: string | number;
  source?: string | null;
  product_name?: string;
  /** 与 slot 一致：`2` 表示订阅续订订单；列表里可能是 number 或 string */
  type?: number | string;
  /** 平台订单号 */
  sn?: string;
  platform_sn?: string;
  created_at?: string;
  updated_at?: string;
  amount?: string;
  status?: number;
  [key: string]: unknown;
};

export type AdminOrderListPayload = {
  data: AdminOrderRow[];
  current_page: number;
  per_page: number;
  count: number;
};

export type AdminOrderInfo = {
  id: number;
  user_id?: string | number;
  status?: number;
  platform?: number;
  amount?: string;
  refund_amount?: string;
  sn?: string;
  platform_sn?: string;
  /** `2`：续订订单（与列表 `type` 一致） */
  type?: number | string;
  created_at?: string;
  updated_at?: string;
  billing_status?: number | null;
  billing_amount?: string;
  billing_at?: string | null;
  [key: string]: unknown;
};
