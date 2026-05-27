import { useCallback, useEffect, useState } from "react";
import { Card, Empty, Spin, Typography, message } from "antd";
import { apiGet } from "@/api/client";
import type { ApiResult } from "@/api/types";
import type { AdminAnalysisPayload, AnalysisSourceRow } from "@/types/adminAnalysis";
import styles from "./PromotionSources.module.css";

function totalCount(rows: AnalysisSourceRow[]): number {
  return rows.reduce((a, b) => a + b.count, 0);
}

function SourceBlock({
  title,
  rows,
  barClass,
}: {
  title: string;
  rows: AnalysisSourceRow[];
  barClass: string;
}) {
  const total = totalCount(rows);
  return (
    <Card className={styles.card} title={title} size="small">
      {rows.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
      ) : (
        <div className={styles.list}>
          {rows.map((v, k) => {
            const percent = total > 0 ? ((v.count / total) * 100).toFixed(2) : "0.00";
            const w = total > 0 ? `${(v.count / total) * 100}%` : "0%";
            return (
              <div key={`${v.source}-${k}`} className={styles.row}>
                <div className={`${styles.bar} ${barClass}`} style={{ width: w }} />
                <div className={styles.rowInner}>
                  <div className={styles.rowLeft}>
                    <span className={styles.count}>{v.count}</span>
                    <span className={styles.source}>{v.source || "—"}</span>
                  </div>
                  <span className={styles.pct}>{percent}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export function PromotionSources() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AdminAnalysisPayload | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res: ApiResult<AdminAnalysisPayload> = await apiGet<AdminAnalysisPayload>("admin/analysis");
      if (res.c !== 0) {
        message.error(res.m || "加载失败");
        setData(null);
        return;
      }
      const d = res.d;
      setData({
        source_today: Array.isArray(d?.source_today) ? d.source_today : [],
        source_week: Array.isArray(d?.source_week) ? d.source_week : [],
        source_all: Array.isArray(d?.source_all) ? d.source_all : [],
      });
    } catch {
      message.error("网络异常");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        推广来源
      </Typography.Title>

      {loading ? (
        <div style={{ padding: 48, textAlign: "center" }}>
          <Spin spinning size="large" tip="加载中">
            <div style={{ minHeight: 120 }} />
          </Spin>
        </div>
      ) : data ? (
        <div className={styles.sections}>
          <SourceBlock title="今日" rows={data.source_today} barClass={styles.barToday} />
          <SourceBlock title="本周" rows={data.source_week} barClass={styles.barWeek} />
          <div className={styles.spanFull}>
            <SourceBlock title="全部" rows={data.source_all} barClass={styles.barAll} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
