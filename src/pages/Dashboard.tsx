import { useEffect, useState } from "react";
import { Alert, Card, Col, List, Row, Spin, Statistic, Typography } from "antd";
import { apiGet } from "@/api/client";
import type { ApiResult } from "@/api/types";
import type { AdminHomeData } from "@/types/adminHome";
import { legacyAdminOrigin } from "@/lib/legacyAdminUrl";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function strFixed(v: unknown, digits: number): string {
  const n = parseFloat(String(v ?? "0"));
  return Number.isFinite(n) ? n.toFixed(digits) : "0.00";
}

export function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<AdminHomeData | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    void (async () => {
      try {
        const res: ApiResult<AdminHomeData> = await apiGet<AdminHomeData>("admin/home");
        if (cancelled) {
          return;
        }
        if (res.c !== 0) {
          setErr(res.m || "加载失败");
          setData(null);
        } else {
          setData(res.d ?? null);
        }
      } catch {
        if (!cancelled) {
          setErr("网络异常");
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const origin = legacyAdminOrigin();

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

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic title="今日独立访客" value={num(data.uv)} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic title="今日页面浏览量" value={num(data.pv)} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic title="今日解锁" value={num(data.unlock)} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic title="今日播放" value={num(data.play)} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic title="注册用户" value={num(data.registered_user)} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic title="未付款订单" value={num(data.unpaid_order)} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic title="已付款订单" value={num(data.paid_order)} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic title="订阅" value={num(data.subscription)} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic title="留存时长（小时）" value={strFixed(data.total_alive_time, 2)} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic title="平均留存（分钟）" value={strFixed(data.average_alive_time, 2)} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="播放排行" size="small">
            {playRank.length === 0 ? (
              <Typography.Text type="secondary">暂无更多</Typography.Text>
            ) : (
              <List
                size="small"
                dataSource={playRank}
                renderItem={(item, index) => {
                  const id = item.target;
                  const href = origin && id != null ? `${origin}/z/page/movie/detail/${id}` : undefined;
                  return (
                    <List.Item>
                      <Typography.Text strong style={{ width: 28 }}>
                        {index + 1}
                      </Typography.Text>
                      {href ? (
                        <Typography.Link href={href} target="_blank" rel="noreferrer">
                          {String(item.title ?? "—")}
                        </Typography.Link>
                      ) : (
                        <span>{String(item.title ?? "—")}</span>
                      )}
                    </List.Item>
                  );
                }}
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
                  const href = origin && uid != null ? `${origin}/z/page/user/${uid}` : undefined;
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
    </div>
  );
}
