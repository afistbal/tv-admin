import { useEffect, useState } from "react";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { Button, Spin, Typography, message } from "antd";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiGet } from "@/api/client";
import type { ApiResult } from "@/api/types";
import type { AdminUserStatPayload } from "@/types/adminUserStat";
import { UserActivityCards } from "@/components/UserActivityCards";

export function UserActivity() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const idNum = userId != null ? Number.parseInt(userId, 10) : NaN;
  const validId = Number.isFinite(idNum) && idNum > 0;

  const [loading, setLoading] = useState(true);
  const [stat, setStat] = useState<AdminUserStatPayload | null>(null);

  useEffect(() => {
    if (!validId) {
      setLoading(false);
      setStat(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res: ApiResult<AdminUserStatPayload> = await apiGet<AdminUserStatPayload>("admin/user/stat", {
          id: idNum,
        });
        if (cancelled) {
          return;
        }
        if (res.c !== 0) {
          message.error(res.m || "加载失败");
          setStat(null);
          return;
        }
        const d = res.d;
        setStat({
          count: Number(d?.count) || 0,
          data: Array.isArray(d?.data) ? d.data : [],
        });
      } catch {
        if (!cancelled) {
          message.error("网络异常");
          setStat(null);
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
  }, [idNum, validId]);

  if (!validId) {
    return (
      <div>
        <Typography.Text type="secondary">无效的用户 ID</Typography.Text>
        <div style={{ marginTop: 12 }}>
          <Link to="/users/list">返回用户列表</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
          返回
        </Button>
        <Typography.Title level={4} style={{ margin: 0 }}>
          活动日志
        </Typography.Title>
        <Typography.Text type="secondary">用户编号 {idNum}</Typography.Text>
        <Link to="/users/list" style={{ marginLeft: "auto" }}>
          用户列表
        </Link>
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: "center" }}>
          <Spin spinning size="large" tip="加载中">
            <div style={{ minHeight: 120 }} />
          </Spin>
        </div>
      ) : stat ? (
        <UserActivityCards rows={stat.data} count={stat.count} />
      ) : null}
    </div>
  );
}
