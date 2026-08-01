export type NativeSubscriptionPlatform = "ios" | "android";

export type AdminNativeSubscriptionRow = {
  id: number;
  platform: NativeSubscriptionPlatform;
  user_id: number | string;
  pay_no: string;
  product_id: string;
  product_name: string;
  started_at: string | null;
  period_end_at: string | null;
  status: 1 | 2 | 3 | 4 | 5 | 6 | number;
  status_name: string;
  subscription_state: string | null;
  auto_renewing: 0 | 1 | number;
  successful_renewal_count: number;
  cycle_count: number;
  source: string | null;
  payment_method: string | null;
  provider_id: string | null;
  chain_id: string | null;
  amount: string | number | null;
  currency: string | null;
  updated_at: string | null;
};

export type AdminNativeSubscriptionCycleStat = {
  cycle: number;
  success_count: number;
  cohort_count: number;
  rate: number;
};

export type AdminNativeSubscriptionStat = {
  total_subscriptions: number;
  active_subscriptions: number;
  renewal_events: number;
  cycles: AdminNativeSubscriptionCycleStat[];
};

export type AdminNativeSubscriptionListPayload = {
  current_page: number;
  data: AdminNativeSubscriptionRow[];
  from: number | null;
  last_page: number | null;
  per_page: number;
  to: number | null;
  count: number;
  stat: AdminNativeSubscriptionStat;
};
