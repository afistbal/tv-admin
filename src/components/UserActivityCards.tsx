import type { ReactNode } from "react";
import { Typography } from "antd";
import type { AdminUserStatRow } from "@/types/adminUserStat";
import { publicWebOrigin } from "@/lib/publicWebOrigin";
import { activityActionLabel } from "@/lib/userActivityLabels";
import { formatDateTimeZh } from "@/lib/formatDateTime";
import styles from "./UserActivityCards.module.css";

function StatTargetCell({ row }: { row: AdminUserStatRow }): ReactNode {
  const origin = publicWebOrigin();
  const act = String(row.action ?? "");
  if (act === "play" && row.target != null && String(row.target) !== "0") {
    const t = String(row.target);
    return (
      <a className={styles.activityLink} href={`${origin}/z/page/movie/detail/${t}`} target="_blank" rel="noreferrer">
        {t}
      </a>
    );
  }
  if (act === "play_episode" && row.movie_id != null && String(row.movie_id) !== "") {
    const mid = String(row.movie_id);
    return (
      <a className={styles.activityLink} href={`${origin}/z/page/movie/detail/${mid}`} target="_blank" rel="noreferrer">
        {String(row.episode_desc ?? mid)}
      </a>
    );
  }
  const tgt = row.target;
  if (tgt === 0 || tgt === "0") {
    return "";
  }
  if (tgt == null || tgt === "") {
    return "";
  }
  return String(tgt);
}

export type UserActivityCardsProps = {
  rows: AdminUserStatRow[];
  count: number;
  emptyHint?: string;
};

export function UserActivityCards({ rows, count, emptyHint = "暂无活动记录" }: UserActivityCardsProps) {
  return (
    <>
      <div className={styles.activityMeta}>共 {count} 条</div>
      <div className={styles.activityList}>
        {rows.length > 0 ? (
          rows.map((row, idx) => {
            const action = String(row.action ?? "");
            return (
              <div
                key={row.id != null ? String(row.id) : `row-${idx}-${String(row.created_at)}`}
                className={styles.activityCard}
              >
                <div className={styles.activityCardHd}>
                  <span>{activityActionLabel(action)}</span>
                  <span>{formatDateTimeZh(row.created_at)}</span>
                </div>
                <div className={styles.activityCardBd}>
                  <div className={styles.activityField}>
                    <span className={styles.activityFieldLabel}>对象</span>
                    <span className={styles.activityFieldVal}>
                      <StatTargetCell row={row} />
                    </span>
                  </div>
                  <div className={styles.activityField}>
                    <span className={styles.activityFieldLabel}>来源</span>
                    <span className={styles.activityFieldVal}>{String(row.source ?? "—")}</span>
                  </div>
                  <div className={styles.activityField}>
                    <span className={styles.activityFieldLabel}>IP</span>
                    <span className={styles.activityFieldVal}>{String(row.ip ?? "—")}</span>
                  </div>
                  <div className={styles.activityField}>
                    <span className={styles.activityFieldLabel}>国家</span>
                    <span className={styles.activityFieldVal}>{String(row.country ?? "—")}</span>
                  </div>
                  <div className={styles.activityField}>
                    <span className={styles.activityFieldLabel}>备注</span>
                    <span className={styles.activityFieldVal}>{String(row.remark ?? "—")}</span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <Typography.Text type="secondary">{emptyHint}</Typography.Text>
        )}
      </div>
    </>
  );
}
