import { useCallback, useEffect, useMemo, useState } from "react";
import { FileTextOutlined } from "@ant-design/icons";
import { Alert, Card, Col, List, Row, Spin, Statistic, Typography } from "antd";
import { Link } from "react-router-dom";
import { apiGet } from "@/api/client";
import type { ApiResult } from "@/api/types";
import type { AdminHomeData, AdminHomePlayRankItem } from "@/types/adminHome";
import { useAppStaticBase } from "@/config/AppConfigContext";
import { adminMovieListPath } from "@/lib/adminMovieListUrl";
import { legacyAdminOrigin } from "@/lib/legacyAdminUrl";
import { publicWebOriginForVideo } from "@/lib/publicWebOrigin";
import { MovieEditModal } from "./MovieEditModal";
import styles from "./Dashboard.module.css";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function strFixed(v: unknown, digits: number): string {
  const n = parseFloat(String(v ?? "0"));
  return Number.isFinite(n) ? n.toFixed(digits) : "0.00";
}

function playMovieUrl(id: string | number): string {
  return `${publicWebOriginForVideo()}/video/${id}`;
}

function PlayRankItem({
  item,
  index,
  onOpenMovie,
}: {
  item: AdminHomePlayRankItem;
  index: number;
  onOpenMovie: (movieId: number) => void;
}) {
  const movieId = Number(item.target);
  const hasId = Number.isFinite(movieId) && movieId > 0;
  const playUrl = hasId ? playMovieUrl(movieId) : "";

  return (
    <List.Item>
      <div className={styles.playRankHead}>
        <div className={styles.playRankTitleRow}>
          <Typography.Text strong className={styles.playRankIndex}>
            {index + 1}.
          </Typography.Text>
          {hasId ? (
            <Typography.Link className={styles.playRankTitleLink} onClick={() => onOpenMovie(movieId)}>
              {String(item.title ?? "—")}
            </Typography.Link>
          ) : (
            <span className={styles.playRankTitlePlain}>{String(item.title ?? "—")}</span>
          )}
          {hasId ? (
            <Link
              to={adminMovieListPath(movieId)}
              className={styles.playRankMoreIcon}
              title="在剧集列表中查看"
              aria-label="在剧集列表中查看"
            >
              <FileTextOutlined />
            </Link>
          ) : null}
        </div>
        <Typography.Text type="secondary" className={styles.playRankMeta}>
          {num(item.count)} 次
        </Typography.Text>
      </div>

      {hasId ? (
        <div className={styles.playRankPlayRow}>
          <span className={styles.playUrlInline}>
            <Typography.Link className={styles.playRankPlayLink} href={playUrl} target="_blank" rel="noreferrer">
              {playUrl}
            </Typography.Link>
            <Typography.Text className={styles.playRankCopy} copyable={{ text: playUrl }} />
          </span>
        </div>
      ) : null}
    </List.Item>
  );
}

export function Dashboard() {
  const appStatic = useAppStaticBase();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<AdminHomeData | null>(null);
  const [editMovieId, setEditMovieId] = useState<number | null>(null);

  const loadHome = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setErr(null);
    }
    try {
      const res: ApiResult<AdminHomeData> = await apiGet<AdminHomeData>("admin/home");
      if (res.c !== 0) {
        if (!silent) {
          setErr(res.m || "加载失败");
          setData(null);
        }
        return;
      }
      setData(res.d ?? null);
      if (silent) {
        setErr(null);
      }
    } catch {
      if (!silent) {
        setErr("网络异常");
        setData(null);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadHome();
  }, [loadHome]);

  const legacyOrigin = legacyAdminOrigin();

  const statItems = useMemo(() => {
    if (!data) {
      return [];
    }
    return [
      { title: "今日独立访客", value: num(data.uv) },
      { title: "今日页面浏览量", value: num(data.pv) },
      { title: "今日解锁", value: num(data.unlock) },
      { title: "今日播放", value: num(data.play) },
      { title: "注册用户", value: num(data.registered_user) },
      { title: "未付款订单", value: num(data.unpaid_order) },
      { title: "已付款订单", value: num(data.paid_order) },
      { title: "订阅", value: num(data.subscription) },
      { title: "留存时长（小时）", value: strFixed(data.total_alive_time, 2) },
      { title: "平均留存（分钟）", value: strFixed(data.average_alive_time, 2) },
    ];
  }, [data]);

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: "center" }}>
        <Spin size="large" tip="加载中…" />
      </div>
    );
  }

  if (err || !data) {
    return <Alert type="error" message={err ?? "暂无数据"} showIcon />;
  }

  const playRank = Array.isArray(data.play_rank) ? data.play_rank : [];
  const aliveRank = Array.isArray(data.alive_ranking) ? data.alive_ranking : [];

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        仪表盘
      </Typography.Title>

      <Card size="small" style={{ marginBottom: 16 }} styles={{ body: { background: "#f6ffed", border: "1px solid #b7eb8f" } }}>
        <Typography.Text>
          共 <Typography.Text strong>{num(data.total_uploaded)}</Typography.Text> 部影片，今日上传{" "}
          <Typography.Text strong>{num(data.today_uploaded)}</Typography.Text> 部
        </Typography.Text>
      </Card>

      <div className={styles.statGrid}>
        {statItems.map((s) => (
          <Card key={s.title} size="small" className={styles.statCard}>
            <Statistic title={s.title} value={s.value} />
          </Card>
        ))}
      </div>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="播放排行" size="small">
            {playRank.length === 0 ? (
              <Typography.Text type="secondary">暂无更多</Typography.Text>
            ) : (
              <List
                className={styles.playRankList}
                size="small"
                dataSource={playRank}
                renderItem={(item, index) => (
                  <PlayRankItem item={item} index={index} onOpenMovie={setEditMovieId} />
                )}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="留存排行（分钟）" size="small">
            {aliveRank.length === 0 ? (
              <Typography.Text type="secondary">暂无更多</Typography.Text>
            ) : (
              <List
                size="small"
                dataSource={aliveRank}
                renderItem={(item, index) => {
                  const uid = item.user_id;
                  const href = legacyOrigin && uid != null ? `${legacyOrigin}/z/page/user/${uid}` : undefined;
                  return (
                    <List.Item
                      actions={[
                        <Typography.Text type="secondary" key="t">
                          {strFixed(item.time, 2)}
                        </Typography.Text>,
                      ]}
                    >
                      <Typography.Text strong style={{ marginRight: 8 }}>
                        {index + 1}
                      </Typography.Text>
                      {href ? (
                        <Typography.Link href={href} target="_blank" rel="noreferrer">
                          用户 {String(uid)}
                        </Typography.Link>
                      ) : (
                        <span>用户 {String(uid)}</span>
                      )}
                    </List.Item>
                  );
                }}
              />
            )}
          </Card>
        </Col>
      </Row>

      {editMovieId != null ? (
        <MovieEditModal
          key={editMovieId}
          movieId={editMovieId}
          staticBase={appStatic}
          onClose={() => setEditMovieId(null)}
          onSaved={() => {
            setEditMovieId(null);
            void loadHome(true);
          }}
        />
      ) : null}
    </div>
  );
}
