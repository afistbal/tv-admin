import dayjs, { type Dayjs } from "dayjs";
import type { SorterResult } from "antd/es/table/interface";
import { rangeToDaterangeStrings, SUBSCRIPTION_PRODUCT_FILTER_OPTIONS } from "@/lib/subscriptionUserDisplay";

export const SUBSCRIPTION_LIST_PAGE_SIZE = 24;

export type SubscriptionTimeType = "created_at" | "updated_at";

export const SUBSCRIPTION_TIME_TYPE_OPTIONS: { value: SubscriptionTimeType; label: string }[] = [
  { value: "created_at", label: "续费时间" },
  { value: "updated_at", label: "更新时间" },
];

/** 与产品管理 id 一致：1 周 / 2 月 / 3 年 / 4 日 */
export const SUBSCRIPTION_PRODUCT_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "全部" },
  ...SUBSCRIPTION_PRODUCT_FILTER_OPTIONS,
];

/** 日期快捷：今天 / 近 3、7 天 / 近 1 个月（含今天） */
export function subscriptionDateRangePresets(): { label: string; value: [Dayjs, Dayjs] }[] {
  const end = dayjs().startOf("day");
  return [
    { label: "今天", value: [end, end] },
    { label: "3天", value: [end.subtract(2, "day"), end] },
    { label: "7天", value: [end.subtract(6, "day"), end] },
    { label: "1个月", value: [end.subtract(1, "month").startOf("day"), end] },
  ];
}

export type SubscriptionListQuery = {
  userId: string;
  range: [Dayjs, Dayjs] | null;
  status: string;
  timeType: SubscriptionTimeType;
  productId: string;
  channel: string;
  /** 如 created_at|DESC、created_at|ASC */
  orderBy: string;
  page: number;
};

export function buildSubscriptionListBody(q: SubscriptionListQuery): Record<string, unknown> {
  const body: Record<string, unknown> = {
    timeType: q.timeType,
  };
  if (q.range) {
    body.daterange = rangeToDaterangeStrings(q.range);
  }
  const uid = q.userId.trim();
  if (uid !== "") {
    body.keyword = uid;
  }
  if (q.status !== "") {
    const n = Number(q.status);
    body.status = Number.isFinite(n) ? n : q.status;
  }
  if (q.productId !== "") {
    body.pid = q.productId;
  }
  const channel = q.channel.trim();
  if (channel !== "") {
    body.source = channel;
  }
  if (q.orderBy) {
    body.orderBy = q.orderBy;
  }
  body.page = q.page;
  return body;
}

/** 表头排序 → orderBy（字段|ASC / 字段|DESC） */
export function tableSorterToOrderBy<T>(
  sorter: SorterResult<T> | SorterResult<T>[] | undefined,
  field: string,
): string {
  const s = Array.isArray(sorter) ? sorter[0] : sorter;
  if (!s?.order) return "";
  const key = (s.columnKey ?? s.field) as string | undefined;
  if (key !== field) return "";
  return s.order === "ascend" ? `${field}|ASC` : `${field}|DESC`;
}

export function orderByToSortOrder(orderBy: string, field: string): "ascend" | "descend" | null {
  if (orderBy === `${field}|ASC`) return "ascend";
  if (orderBy === `${field}|DESC`) return "descend";
  return null;
}

export function timeTypeFilterLabel(timeType: SubscriptionTimeType): string {
  return SUBSCRIPTION_TIME_TYPE_OPTIONS.find((o) => o.value === timeType)?.label ?? timeType;
}

export function productFilterLabel(productId: string): string {
  if (productId === "") {
    return "全部";
  }
  return SUBSCRIPTION_PRODUCT_OPTIONS.find((o) => o.value === productId)?.label ?? productId;
}

export function channelFilterLabel(channel: string): string {
  return channel.trim() === "" ? "全部" : channel.trim();
}
