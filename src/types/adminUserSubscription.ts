/** POST `admin/user/subscription`：订阅用户列表 */

export type AdminUserSubscriptionRow = {
  id?: number;
  user_id?: string | number;
  /** 关联订单 id（字符串或数字） */
  order_id?: string | number;
  status?: number;
  /** 仅 `status === 1` 时参与展示：`1` 续订，`0`/缺省 首次，其余值 待定 */
  is_renewal?: boolean | number | string | null;
  billing_amount?: string | number | null;
  /** 付款方式；无字段时列表显示 `-`，枚举见 `SubscriptionPaymentMethodKey` */
  payment_method?: string | null;
  billing_at?: string | null;
  /** 实际支付成功时间等，有则展示「支付时间」 */
  paid_at?: string | null;
  pay_time?: string | null;
  payment_at?: string | null;
  product_name?: string | null;
  platform_sn?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

export type AdminUserSubscriptionListPayload = {
  data: AdminUserSubscriptionRow[];
  current_page: number;
  per_page: number;
  count: number;
};
