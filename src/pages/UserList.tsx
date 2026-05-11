import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Avatar,
  Button,
  DatePicker,
  Input,
  Modal,
  Pagination,
  Radio,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import type { ColumnsType } from "antd/es/table";
import { apiGet, apiPostJson } from "@/api/client";
import type { ApiGetQueryValue } from "@/api/client";
import type { ApiResult } from "@/api/types";
import type { AdminUserListPayload, AdminUserRow } from "@/types/adminUser";
import type { AdminUserInfo } from "@/types/adminUserInfo";
import { formatUserUniqueIdForDisplay } from "@/lib/formatUserUniqueIdForDisplay";
import { formatDateTimeZh } from "@/lib/formatDateTime";
import styles from "./UserList.module.css";

const TYPE_ALL = 0;
const TYPE_REGISTERED = 1;
const TYPE_ANONYMOUS = 2;

/** GET `admin/user`：`admin` 0=非管理员 1=管理员；全部不传该字段 */
type AdminSearchFilter = "all" | "0" | "1";

/** 与 OrderList 一致：GET 由 client 将 `daterange` 展开为 `daterange[0]` / `daterange[1]` */
function defaultTodayRange(): [Dayjs, Dayjs] {
  const d = dayjs();
  return [d.startOf("day"), d.startOf("day")];
}

function rangeToDaterangeStrings(range: [Dayjs, Dayjs]): [string, string] {
  const [from, to] = range;
  return [from.startOf("day").format("YYYY-MM-DD HH:mm:ss"), to.endOf("day").format("YYYY-MM-DD HH:mm:ss")];
}

/** 界面文案为简体中文；语义与 slot 后台字段一致。 */

function fmtSource(v: unknown): string {
  const s = String(v ?? "").trim();
  return s || "—";
}

function fmtAliveMinutes(alive: unknown): string {
  const n = Number(alive);
  if (!Number.isFinite(n)) {
    return "—";
  }
  if (n === 0) {
    return "< 1 分钟";
  }
  return `${(n / 60).toFixed(2)} 分钟`;
}

export function UserList() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(24);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [type, setType] = useState(TYPE_ALL);
  const [adminSearch, setAdminSearch] = useState<AdminSearchFilter>("all");
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(() => defaultTodayRange());
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [info, setInfo] = useState<AdminUserInfo | null>(null);
  const [isAdmin, setIsAdmin] = useState<"yes" | "no">("no");
  const [isVip, setIsVip] = useState<"yes" | "no">("no");
  const [saving, setSaving] = useState(false);
  const [cancelSubLoadingId, setCancelSubLoadingId] = useState<number | null>(null);
  const searchTimer = useRef<number | null>(null);

  const fetchList = useCallback(
    async (p: number, kw: string, t: number, range: [Dayjs, Dayjs] | null, admin: AdminSearchFilter) => {
    setLoading(true);
    try {
      const q: Record<string, ApiGetQueryValue> = {
        page: p,
        keyword: kw,
        type: t,
      };
      if (range != null) {
        q.daterange = rangeToDaterangeStrings(range);
      }
      if (admin !== "all") {
        q.admin = Number(admin);
      }
      const res: ApiResult<AdminUserListPayload> = await apiGet<AdminUserListPayload>("admin/user", q);
      if (res.c !== 0) {
        message.error(res.m || "加载失败");
        setRows([]);
        setTotal(0);
        return;
      }
      const d = res.d;
      setRows(Array.isArray(d.data) ? d.data : []);
      setTotal(Number(d.count) || 0);
      setPerPage(Number(d.per_page) || 24);
      setPage(Number(d.current_page) || p);
    } catch {
      message.error("网络异常");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  },
    [],
  );

  useEffect(() => {
    void fetchList(page, keyword, type, dateRange, adminSearch);
  }, [page, keyword, type, dateRange, adminSearch, fetchList]);

  useEffect(() => {
    if (detailId == null) {
      setInfo(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setInfo(null);
    void (async () => {
      try {
        const infoRes = await apiGet<AdminUserInfo>("admin/user/info", { id: detailId });
        if (cancelled) {
          return;
        }
        if (infoRes.c !== 0) {
          message.error(infoRes.m || "加载失败");
          setDetailId(null);
          return;
        }
        const d = infoRes.d;
        setInfo(d);
        setIsAdmin(Number(d.admin) > 0 ? "yes" : "no");
        setIsVip(Number(d.vip) > 0 ? "yes" : "no");
      } catch {
        if (!cancelled) {
          message.error("网络异常");
          setDetailId(null);
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detailId]);

  const onKeywordChange = (v: string) => {
    setKeywordInput(v);
    if (searchTimer.current) {
      window.clearTimeout(searchTimer.current);
    }
    searchTimer.current = window.setTimeout(() => {
      setKeyword(v.trim());
      setPage(1);
    }, 400);
  };

  useEffect(
    () => () => {
      if (searchTimer.current) {
        window.clearTimeout(searchTimer.current);
      }
    },
    [],
  );

  const closeDetail = () => {
    setDetailId(null);
    setInfo(null);
    setIsAdmin("no");
    setIsVip("no");
  };

  const handleCancelSubscription = useCallback(
    (userId: number) => {
      Modal.confirm({
        title: "确认取消订阅",
        content: "确定要取消该用户的订阅吗？",
        okText: "确定",
        cancelText: "返回",
        onOk: async () => {
          setCancelSubLoadingId(userId);
          try {
            const res = await apiPostJson<unknown>("subscription/cancel", { id: userId });
            if (res.c !== 0) {
              message.error(res.m || "取消订阅失败");
              return;
            }
            message.success("已取消订阅");
            void fetchList(page, keyword, type, dateRange, adminSearch);
          } catch {
            message.error("网络异常");
          } finally {
            setCancelSubLoadingId(null);
          }
        },
      });
    },
    [fetchList, page, keyword, type, dateRange, adminSearch],
  );

  const handleSave = async () => {
    if (detailId == null) {
      return;
    }
    setSaving(true);
    try {
      /** 与 slot_old `UserDetail` 一致：`api('admin/user/save', { data })` 未指定 method 时为 GET + query */
      const res = await apiGet<unknown>("admin/user/save", {
        id: detailId,
        admin: isAdmin === "yes" ? 1 : 0,
        vip: isVip === "yes" ? 1 : 0,
      });
      if (res.c !== 0) {
        message.error(res.m || "保存失败");
        return;
      }
      message.success("保存成功");
      void fetchList(page, keyword, type, dateRange, adminSearch);
      closeDetail();
    } catch {
      message.error("网络异常");
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<AdminUserRow> = useMemo(
    () => [
      {
        title: "uid",
        dataIndex: "id",
        width: 112,
        fixed: "left",
        render: (v: unknown) => (
          <Typography.Text copyable={{ text: String(v ?? "") }}>
            {String(v ?? "—")}
          </Typography.Text>
        ),
      },
      {
        title: "登录方式",
        dataIndex: "anonymous",
        width: 140,
        render: (v: unknown) =>
          Number(v) === 1 ? <Tag color="orange">游客</Tag> : <Tag color="blue">注册用户</Tag>,
      },
      {
        title: "是否VIP",
        dataIndex: "vip",
        width: 88,
        render: (v: unknown) => (Number(v) > 0 ? "是" : "否"),
      },
      {
        title: "是否管理员",
        dataIndex: "admin",
        width: 112,
        render: (v: unknown) => (Number(v) === 1 ? <Tag color="red">是</Tag> : <Tag>否</Tag>),
      },
      {
        title: "来源",
        dataIndex: "source",
        width: 168,
        ellipsis: true,
        render: (_: unknown, record) => (
          <Typography.Text copyable={String(record.source ?? "").trim() ? { text: String(record.source) } : false}>
            {fmtSource(record.source)}
          </Typography.Text>
        ),
      },
      {
        title: "时间",
        key: "time_pair",
        width: 200,
        render: (_: unknown, record) => (
          <div className={styles.timeCell}>
            <div className={styles.timeLine}>
              <span className={styles.timeLabel}>创建时间：</span>
              <span>{formatDateTimeZh(record.created_at)}</span>
            </div>
            <div className={styles.timeLine}>
              <span className={styles.timeLabel}>登录时间：</span>
              <span>{formatDateTimeZh(record.login_at)}</span>
            </div>
          </div>
        ),
      },
      {
        title: "头像",
        dataIndex: "avatar",
        width: 72,
        render: (v: unknown) => {
          const s = String(v ?? "").trim();
          if (!s) {
            return "—";
          }
          return <Avatar size="small">{s.slice(0, 1).toUpperCase()}</Avatar>;
        },
      },
      {
        title: "操作",
        key: "actions",
        width: 168,
        fixed: "right",
        render: (_: unknown, record) => {
          const isVipRow = Number(record.vip) > 0;
          return (
            <Space size={0} wrap>
              <Button
                type="link"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  setDetailId(record.id);
                }}
              >
                详情
              </Button>
              {isVipRow ? (
                <Button
                  type="link"
                  size="small"
                  danger
                  loading={cancelSubLoadingId === record.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCancelSubscription(record.id);
                  }}
                >
                  取消订阅
                </Button>
              ) : null}
            </Space>
          );
        },
      },
    ],
    [cancelSubLoadingId, handleCancelSubscription],
  );

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        用户
      </Typography.Title>

      <div className={styles.toolbar}>
        <Space wrap className={styles.toolbarLeft}>
          <Typography.Text type="secondary">🙍‍♂️用户数量 {total || "..."}</Typography.Text>
        </Space>
        <Space wrap className={styles.toolbarRight}>
          <Typography.Text type="secondary">日期</Typography.Text>
          <DatePicker.RangePicker
            className={styles.dateRange}
            format="YYYY-MM-DD"
            allowClear
            value={dateRange}
            onChange={(dates) => {
              if (dates?.[0] && dates[1]) {
                setDateRange([dates[0].startOf("day"), dates[1].startOf("day")]);
                setPage(1);
              } else {
                setDateRange(null);
                setPage(1);
              }
            }}
            presets={[
              {
                label: "今天",
                value: [dayjs().startOf("day"), dayjs().startOf("day")] satisfies [Dayjs, Dayjs],
              },
              {
                label: "昨天",
                value: [dayjs().subtract(1, "day").startOf("day"), dayjs().subtract(1, "day").startOf("day")] satisfies [
                  Dayjs,
                  Dayjs,
                ],
              },
            ]}
          />
          <Select
            value={type}
            style={{ width: 160 }}
            onChange={(v) => {
              setType(v);
              setPage(1);
            }}
            options={[
              { value: TYPE_ALL, label: "全部" },
              { value: TYPE_REGISTERED, label: "注册用户" },
              { value: TYPE_ANONYMOUS, label: "游客" },
            ]}
          />
          <Typography.Text type="secondary">管理员</Typography.Text>
          <Select<AdminSearchFilter>
            value={adminSearch}
            style={{ width: 128 }}
            onChange={(v) => {
              setAdminSearch(v);
              setPage(1);
            }}
            options={[
              { value: "all", label: "全部" },
              { value: "0", label: "非管理员" },
              { value: "1", label: "管理员" },
            ]}
          />
          <Input
            allowClear
            placeholder="🔍检索"
            value={keywordInput}
            onChange={(e) => onKeywordChange(e.target.value)}
            style={{ width: 220 }}
            maxLength={32}
          />
          <Button
            type="primary"
            onClick={() => {
              const kw = keywordInput.trim();
              setKeyword(kw);
              setPage(1);
              if (page === 1) {
                void fetchList(1, kw, type, dateRange, adminSearch);
              }
            }}
          >
            搜索
          </Button>
        </Space>
      </div>

      <Table<AdminUserRow>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={false}
        scroll={{ x: 1160 }}
        size="middle"
      />

      <div className={styles.paginationWrap}>
        <Pagination
          current={page}
          pageSize={perPage}
          total={total}
          showSizeChanger={false}
          showTotal={(t) => `🙍‍♂️用户数量 ${t}`}
          onChange={(p) => setPage(p)}
        />
      </div>

      <Modal
        title="用户详情"
        open={detailId != null}
        onCancel={closeDetail}
        footer={
          <Space>
            <Button onClick={closeDetail}>取消</Button>
            <Button type="primary" loading={saving} onClick={() => void handleSave()}>
              保存
            </Button>
          </Space>
        }
        width={640}
        destroyOnClose
      >
        {detailId != null && detailLoading ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <Spin size="large" tip="加载中" />
          </div>
        ) : info ? (
          <>
            <div className={styles.detailSectionTitle}>基本资料</div>
            <div className={styles.detailBlock}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>uid</span>
                <span className={styles.detailValue}>
                  <Typography.Text copyable={{ text: String(info.id) }}>{info.id}</Typography.Text>
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>唯一识别码</span>
                <span className={styles.detailValue}>{formatUserUniqueIdForDisplay(info.unique_id)}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>电子邮件</span>
                <span className={styles.detailValue}>{String(info.email ?? "—")}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>登录方式</span>
                <span className={styles.detailValue}>
                  {Number(info.anonymous) === 1 ? "游客" : "注册用户"}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>来源</span>
                <span className={styles.detailValue}>
                  <Typography.Text
                    copyable={String(info.source ?? "").trim() ? { text: String(info.source) } : false}
                  >
                    {fmtSource(info.source)}
                  </Typography.Text>
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>创建时间</span>
                <span className={styles.detailValue}>{formatDateTimeZh(info.created_at)}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>登录时间</span>
                <span className={styles.detailValue}>{info.login_at ? formatDateTimeZh(info.login_at) : "—"}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>活跃时间</span>
                <span className={styles.detailValue}>{info.active_at ? formatDateTimeZh(info.active_at) : "—"}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>留存时长</span>
                <span className={styles.detailValue}>{fmtAliveMinutes(info.alive_time)}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>活动日志</span>
                <Button
                  type="link"
                  style={{ padding: 0, height: "auto" }}
                  onClick={() => {
                    navigate(`/users/activity/${info.id}`);
                    closeDetail();
                  }}
                >
                  查看活动日志
                </Button>
              </div>
            </div>

            <div className={styles.detailSectionTitle}>用户设置</div>
            <div className={styles.detailBlock}>
              <div className={styles.detailRow} style={{ flexWrap: "wrap", alignItems: "flex-start" }}>
                <span className={styles.detailLabel}>是否管理员</span>
                <Radio.Group
                  className={styles.detailRadios}
                  value={isAdmin}
                  onChange={(e) => setIsAdmin(e.target.value as "yes" | "no")}
                >
                  <Radio value="yes">是</Radio>
                  <Radio value="no">否</Radio>
                </Radio.Group>
              </div>
              <div className={styles.detailRow} style={{ flexWrap: "wrap", alignItems: "flex-start" }}>
                <span className={styles.detailLabel}>是否VIP</span>
                <Radio.Group
                  className={styles.detailRadios}
                  value={isVip}
                  onChange={(e) => setIsVip(e.target.value as "yes" | "no")}
                >
                  <Radio value="yes">是</Radio>
                  <Radio value="no">否</Radio>
                </Radio.Group>
              </div>
            </div>
          </>
        ) : detailId != null ? (
          <Typography.Text type="secondary">没有内容</Typography.Text>
        ) : null}
      </Modal>
    </div>
  );
}
