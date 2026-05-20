import dayjs, { type Dayjs } from "dayjs";
import type { SubscriptionPaymentMethodKey } from "@/types/adminStatSubscription";
import type { AdminUserSubscriptionRow } from "@/types/adminUserSubscription";

export const EMPTY = "-";

/** 默认：今天（两次 dayjs()，与 OrderList / UserList 一致，避免 RangePicker 不展示） */
export function defaultTodayRange(): [Dayjs, Dayjs] {
  return [dayjs().startOf("day"), dayjs().startOf("day")];
}

export function rangeToDaterangeStrings(range: [Dayjs, Dayjs]): [string, string] {
  const [from, to] = range;
  return [from.startOf("day").format("YYYY-MM-DD HH:mm:ss"), to.endOf("day").format("YYYY-MM-DD HH:mm:ss")];
}

/** 如 2026年5月18日 10:46 */
export function formatCnDateTime(v: unknown): string {
  if (v == null || String(v).trim() === "") {
    return EMPTY;
  }
  const d = dayjs(String(v).trim());
  if (!d.isValid()) {
    return String(v);
  }
  return d.format("YYYY年M月D日 H:mm");
}

export function formatCnDate(v: unknown): string {
  return formatCnDateTime(v);
}

export function pickBillingAt(row: AdminUserSubscriptionRow): Dayjs | null {
  const raw = row.billing_at;
  if (raw == null || String(raw).trim() === "") {
    return null;
  }
  const d = dayjs(String(raw).trim());
  return d.isValid() ? d : null;
}

export function pickCreatedAt(row: AdminUserSubscriptionRow): Dayjs | null {
  const raw = row.created_at;
  if (raw == null || String(raw).trim() === "") {
    return null;
  }
  const d = dayjs(String(raw).trim());
  return d.isValid() ? d : null;
}

export function billingRemainingDays(row: AdminUserSubscriptionRow): number | null {
  const end = pickBillingAt(row);
  if (!end) {
    return null;
  }
  return end.startOf("day").diff(dayjs().startOf("day"), "day");
}

export type NotionTagTone = {
  label: string;
  dot: string;
  bg: string;
};

/** 产品 id：1 周 / 2 月 / 3 年 / 4 日 */
export const SUBSCRIPTION_PRODUCT_BY_ID: Record<number, NotionTagTone> = {
  1: { label: "周", dot: "#2fa84f", bg: "rgba(47, 168, 79, 0.12)" },
  2: { label: "月", dot: "#2f6feb", bg: "rgba(47, 111, 235, 0.12)" },
  3: { label: "年", dot: "#9b59b6", bg: "rgba(155, 89, 182, 0.12)" },
  4: { label: "日", dot: "#e67e22", bg: "rgba(230, 126, 34, 0.12)" },
};

export const SUBSCRIPTION_PRODUCT_FILTER_OPTIONS: { value: string; label: string }[] = Object.entries(
  SUBSCRIPTION_PRODUCT_BY_ID,
).map(([id, tone]) => ({ value: id, label: tone.label }));

export function productTypeTone(row: AdminUserSubscriptionRow): NotionTagTone {
  const id = Number(row.product_id);
  return SUBSCRIPTION_PRODUCT_BY_ID[id] ?? { label: `产品${id}`, dot: "#8c8c8c", bg: "rgba(0,0,0,0.06)" };
}

/** 与搜索「状态」下拉、列表展示、接口 `status` 字段共用 */
const SUBSCRIPTION_ORDER_STATUS_OPTIONS: (NotionTagTone & { value: string })[] = [
  { value: "0", label: "0 待定", dot: "#8c8c8c", bg: "rgba(0,0,0,0.08)" },
  { value: "1", label: "1 成功", dot: "#2fa84f", bg: "rgba(47, 168, 79, 0.12)" },
  { value: "2", label: "2 取消订阅", dot: "#9b59b6", bg: "rgba(155, 89, 182, 0.12)" },
  { value: "3", label: "3 订阅异常（二次扣款第一次失败）", dot: "#e03e3e", bg: "rgba(224, 62, 62, 0.12)" },
  { value: "4", label: "4 订阅异常（二次扣款第二次失败）", dot: "#e03e3e", bg: "rgba(224, 62, 62, 0.12)" },
  { value: "5", label: "5 订阅异常（二次扣款第三次失败）", dot: "#e03e3e", bg: "rgba(224, 62, 62, 0.12)" },
  { value: "10", label: "10 订阅失败（不再执行订阅了）", dot: "#e03e3e", bg: "rgba(224, 62, 62, 0.12)" },
];

export const SUBSCRIPTION_ORDER_STATUS_FILTER_OPTIONS = SUBSCRIPTION_ORDER_STATUS_OPTIONS.map(
  ({ value, label }) => ({ value, label }),
);

export function pickIsRenewal(row: AdminUserSubscriptionRow): number | null {
  const raw = row.is_renewal ?? row["isRenewal"];
  if (raw === true) {
    return 1;
  }
  if (raw === false) {
    return 0;
  }
  if (raw == null || String(raw).trim() === "") {
    return 0;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** `status === 1` 时按 `is_renewal` 细分：0 首次订阅、≥1 续订成功、-1 待定 */
function subscriptionSuccessStatusTone(row: AdminUserSubscriptionRow): NotionTagTone {
  const renewal = pickIsRenewal(row);
  if (renewal === -1) {
    return { label: "1 待定", dot: "#8c8c8c", bg: "rgba(0,0,0,0.08)" };
  }
  if (renewal != null && renewal >= 1) {
    return { label: "1 续订成功", dot: "#2f6feb", bg: "rgba(47, 111, 235, 0.12)" };
  }
  return { label: "1 首次订阅", dot: "#2fa84f", bg: "rgba(47, 168, 79, 0.12)" };
}

export function subscriptionOrderStatusTone(row: AdminUserSubscriptionRow): NotionTagTone {
  const status = Number(row.status);
  if (!Number.isFinite(status)) {
    return { label: EMPTY, dot: "#8c8c8c", bg: "rgba(0,0,0,0.06)" };
  }
  if (status === 1) {
    return subscriptionSuccessStatusTone(row);
  }
  const opt = SUBSCRIPTION_ORDER_STATUS_OPTIONS.find((o) => o.value === String(status));
  if (opt) {
    return { label: opt.label, dot: opt.dot, bg: opt.bg };
  }
  return { label: String(status), dot: "#8c8c8c", bg: "rgba(0,0,0,0.06)" };
}

export function subscriptionOrderStatusFilterLabel(value: string): string {
  if (value === "") {
    return "全部";
  }
  const opt = SUBSCRIPTION_ORDER_STATUS_FILTER_OPTIONS.find((o) => o.value === value);
  return opt?.label ?? value;
}

/** 日历等：成功态下的首次 / 续订标签 */
export function subscriptionKindTone(row: AdminUserSubscriptionRow): NotionTagTone {
  const status = Number(row.status);
  if (status !== 1) {
    return { label: "失败", dot: "#e03e3e", bg: "rgba(224, 62, 62, 0.12)" };
  }
  const tone = subscriptionSuccessStatusTone(row);
  if (tone.label === "1 续订成功") {
    return { label: "续订成功", dot: tone.dot, bg: tone.bg };
  }
  if (tone.label === "1 首次订阅") {
    return { label: "首次订阅", dot: tone.dot, bg: tone.bg };
  }
  return { label: "待定", dot: tone.dot, bg: tone.bg };
}

/**
 * 与 Notion 一致：周 = floor(天数/7)，月 = 月差，年 = 年差，其它（含日）= 0
 * `dateBetween(当前周期结束时间, 开始订阅时间)`
 */
export function cycleCount(row: AdminUserSubscriptionRow): string {
  const end = pickBillingAt(row);
  const start = pickCreatedAt(row);
  if (!end || !start) {
    return EMPTY;
  }
  const productId = Number(row.product_id);
  const daySpan = end.diff(start, "day");
  if (productId === 1) {
    return String(Math.floor(daySpan / 7));
  }
  if (productId === 2) {
    return String(end.diff(start, "month"));
  }
  if (productId === 3) {
    return String(end.diff(start, "year"));
  }
  return "0";
}

export function channelTone(row: AdminUserSubscriptionRow): NotionTagTone | null {
  const raw = String(row.source ?? row.channel ?? row.utm_source ?? "").trim();
  if (!raw) {
    return null;
  }
  const lower = raw.toLowerCase();
  if (lower === "organic" || raw === "自然") {
    return { label: "自然", dot: "#2fa84f", bg: "rgba(47, 168, 79, 0.12)" };
  }
  if (lower === "fb" || lower === "facebook") {
    return { label: "FB", dot: "#2f6feb", bg: "rgba(47, 111, 235, 0.12)" };
  }
  return { label: raw, dot: "#8c8c8c", bg: "rgba(0,0,0,0.06)" };
}

/** 日历卡片：仅展示成功态的首次/续费 */
export function isCalendarEligible(row: AdminUserSubscriptionRow): boolean {
  if (Number(row.status) !== 1) {
    return false;
  }
  if (pickIsRenewal(row) === -1) {
    return false;
  }
  return pickBillingAt(row) != null;
}

export function rowStableKey(row: AdminUserSubscriptionRow): string {
  return String(row.id ?? `${row.user_id ?? ""}_${row.order_id ?? ""}_${row.platform_sn ?? ""}`);
}

const PAYMENT_METHOD_KEYS: SubscriptionPaymentMethodKey[] = [
  "apple_pay_visa",
  "apple_pay",
  "google_pay_visa",
  "google_pay",
  "visa",
];

function isPaymentMethodKey(s: string): s is SubscriptionPaymentMethodKey {
  return (PAYMENT_METHOD_KEYS as readonly string[]).includes(s);
}

function pickPaymentMethodRaw(row: AdminUserSubscriptionRow): string {
  const v =
    row.payment_method ??
    row["paymentMethod"] ??
    row["pay_method"] ??
    row["payment_type"] ??
    row["pay_type"];
  return v != null ? String(v).trim() : "";
}

export function paymentMethodTone(row: AdminUserSubscriptionRow): NotionTagTone | null {
  const raw = pickPaymentMethodRaw(row);
  if (!raw) {
    return null;
  }
  if (!isPaymentMethodKey(raw)) {
    return { label: raw, dot: "#8c8c8c", bg: "rgba(0,0,0,0.06)" };
  }
  switch (raw) {
    case "apple_pay_visa":
      return { label: "苹果/visa", dot: "#2fa84f", bg: "rgba(47, 168, 79, 0.12)" };
    case "apple_pay":
      return { label: "苹果", dot: "#2fa84f", bg: "rgba(47, 168, 79, 0.12)" };
    case "google_pay_visa":
      return { label: "谷歌/visa", dot: "#9b59b6", bg: "rgba(155, 89, 182, 0.12)" };
    case "google_pay":
      return { label: "谷歌", dot: "#9b59b6", bg: "rgba(155, 89, 182, 0.12)" };
    default:
      return { label: "visa", dot: "#2f6feb", bg: "rgba(47, 111, 235, 0.12)" };
  }
}
