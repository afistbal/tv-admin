/** POST `admin/user/subscription`：订阅用户列表 */

export type AdminUserSubscriptionStat = {
  pay_count2?: number;
  wait_count2?: number;
  pay_count3?: number;
  wait_count3?: number;
  pay_count4?: number;
  wait_count4?: number;
  pay_count5?: number;
  wait_count5?: number;
  pay_count6?: number;
  wait_count6?: number;
  pay_count7?: number;
  wait_count7?: number;
  pay_count8?: number;
  wait_count8?: number;
  pay_count1?: number;
  wait_count1?: number;
  [key: string]: unknown;
};

export type AdminUserSubscriptionRow = {
  id?: number;
  user_id?: string | number;
  /** 关联订单 id（字符串或数字） */
  order_id?: string | number;
  status?: number;
  /** 空中授权状态码；接口原样返回展示 */
  response_code?: string | number | null;
  /** `status === 1`：`0`/缺省 首次订阅，`≥1` 续订成功，`-1` 不参与日历展示 */
  is_renewal?: boolean | number | string | null;
  /** 已支付次数；筛选传 0–8；列表成功次数展示 pay_count + 1 */
  pay_count?: number | string | null;
  billing_amount?: string | number | null;
  /** 付款方式；无字段时列表显示 `-`，枚举见 `SubscriptionPaymentMethodKey` */
  payment_method?: string | null;
  billing_at?: string | null;
  /** 实际支付成功时间等，有则展示「支付时间」 */
  paid_at?: string | null;
  pay_time?: string | null;
  payment_at?: string | null;
  product_id?: number | string | null;
  product_name?: string | null;
  /** 投放渠道 */
  source?: string | null;
  channel?: string | null;
  country?: string | null;
  platform_sn?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

/** `POST admin/subscription/save`：单条 `id`；批量 `ids` 英文逗号分隔 */
export type AdminSubscriptionSaveBody =
  | { id: number; status: number; ids?: never }
  | { ids: string; status: number; id?: never };

export type AdminUserSubscriptionListPayload = {
  data: AdminUserSubscriptionRow[];
  current_page: number;
  per_page: number;
  count: number;
  stat?: AdminUserSubscriptionStat | null;
};

export type SubscriptionRenewalStatRow = {
  cycle: number;
  label: string;
  pay: number | null;
  wait: number | null;
  total: number;
  ratePct: number | null;
};
