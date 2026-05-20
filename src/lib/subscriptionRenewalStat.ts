import type {
  AdminUserSubscriptionStat,
  SubscriptionRenewalStatRow,
} from "@/types/adminUserSubscription";

/** 展示到第几次订阅（含首次） */
export const SUBSCRIPTION_STAT_MAX_CYCLE = 8;

const CYCLE_LABELS: Record<number, string> = {
  1: "一次订阅",
  2: "二次订阅",
  3: "三次订阅",
  4: "四次订阅",
  5: "五次订阅",
  6: "六次订阅",
  7: "七次订阅",
  8: "八次订阅",
};

function pickStatNum(stat: AdminUserSubscriptionStat | null | undefined, key: string): number | null {
  if (stat == null) {
    return null;
  }
  const raw = stat[key];
  if (raw == null || raw === "") {
    return null;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function formatRate(pay: number, total: number): number | null {
  if (total <= 0) {
    return null;
  }
  return Math.round((pay / total) * 1000) / 10;
}

/**
 * 首次订阅：total 用接口 `count`；第 2–8 次：pay/wait 来自 stat，total = pay + wait。
 */
export function buildSubscriptionRenewalStatRows(
  count: number,
  stat: AdminUserSubscriptionStat | null | undefined,
): SubscriptionRenewalStatRow[] {
  const rows: SubscriptionRenewalStatRow[] = [];

  for (let cycle = 1; cycle <= SUBSCRIPTION_STAT_MAX_CYCLE; cycle++) {
    const label = CYCLE_LABELS[cycle] ?? `${cycle}次订阅`;

    if (cycle === 1) {
      const total = Math.max(0, Number(count) || 0);
      rows.push({ cycle, label, pay: null, wait: null, total, ratePct: null });
      continue;
    }

    const pay = pickStatNum(stat, `pay_count${cycle}`) ?? 0;
    const wait = pickStatNum(stat, `wait_count${cycle}`) ?? 0;
    const total = pay + wait;
    rows.push({
      cycle,
      label,
      pay,
      wait,
      total,
      ratePct: formatRate(pay, total),
    });
  }

  return rows;
}

export function formatStatCellNum(v: number | null): string {
  if (v == null) {
    return "—";
  }
  return String(v);
}

export function formatStatRate(v: number | null): string {
  if (v == null) {
    return "—";
  }
  return `${v}%`;
}
