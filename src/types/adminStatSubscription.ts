/** admin/stat/subscription-users 等：订阅用户统计列表（字段名以后端为准） */

/** 支付方式（假数据枚举；接口就绪后对齐后端） */
export type SubscriptionPaymentMethodKey =
  | "apple_pay_visa"
  | "apple_pay"
  | "google_pay_visa"
  | "google_pay"
  | "visa";

/** `status`：与代收订单常用枚举对齐 — `0` 待支付、`1` 已支付、`2` 已退款；`3` 扣费失败（订阅场景扩展） */
export type SubscriptionUserRow = {
  key: string;
  uid: string;
  /** 与代收列表 `product_name` 语义一致 */
  productName: string;
  /** 与代收列表金额展示一致（假数据为字符串） */
  amount: string;
  /** 续订订单，与代收列表「续订」Tag 一致 */
  isRenewal?: boolean;
  status: 0 | 1 | 2 | 3;
  paymentMethod: SubscriptionPaymentMethodKey;
  /** 待扣费（展示用 ISO 字符串） */
  pendingBillingTime: string | null;
  /** 实际扣费或失败时间 */
  billingTime: string | null;
  /** 已扣费、扣费失败时有平台订单号 */
  platformSn: string | null;
};
