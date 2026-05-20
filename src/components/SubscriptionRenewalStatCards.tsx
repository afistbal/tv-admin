import { Spin } from "antd";
import type { SubscriptionRenewalStatRow } from "@/types/adminUserSubscription";
import { formatStatRate } from "@/lib/subscriptionRenewalStat";
import styles from "./SubscriptionRenewalStatCards.module.css";

type Props = {
  rows: SubscriptionRenewalStatRow[];
  loading?: boolean;
};

function FirstSubscriptionCard({ row }: { row: SubscriptionRenewalStatRow }) {
  return (
    <article className={styles.card}>
      <div className={styles.cardTitle}>{row.label}</div>
      <div className={styles.firstMain}>
        <span className={styles.heroNum}>{row.total}</span>
      </div>
      {/* 占位，与二次及以上卡片的成功率行等高 */}
      <div className={`${styles.renewalRate} ${styles.renewalRateHidden}`} aria-hidden>
        —
      </div>
    </article>
  );
}

function RenewalCard({ row }: { row: SubscriptionRenewalStatRow }) {
  const pay = row.pay ?? 0;
  return (
    <article className={styles.card}>
      <div className={styles.cardTitle}>{row.label}</div>
      <div className={styles.renewalMain}>
        <span className={styles.renewalPay}>{pay}</span>
        <span className={styles.renewalSlash}>/</span>
        <span className={styles.renewalTotal}>{row.total}</span>
      </div>
      <div className={styles.renewalRate}>{formatStatRate(row.ratePct)}</div>
    </article>
  );
}

function StatCard({ row }: { row: SubscriptionRenewalStatRow }) {
  if (row.cycle === 1) {
    return <FirstSubscriptionCard row={row} />;
  }
  return <RenewalCard row={row} />;
}

export function SubscriptionRenewalStatCards({ rows, loading }: Props) {
  return (
    <Spin spinning={loading}>
      <div className={styles.track} role="list" aria-label="续订统计">
        {rows.length === 0 && !loading ? (
          <div className={styles.empty}>暂无统计</div>
        ) : (
          rows.map((row) => (
            <div key={row.cycle} className={styles.cardWrap} role="listitem">
              <StatCard row={row} />
            </div>
          ))
        )}
      </div>
    </Spin>
  );
}
