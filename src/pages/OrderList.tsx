import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Button,
  DatePicker,
  Descriptions,
  Input,
  Modal,
  Pagination,
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
import { apiGet } from "@/api/client";
import type { ApiGetQueryValue } from "@/api/client";
import type { ApiResult } from "@/api/types";
import type { AdminOrderInfo, AdminOrderListPayload, AdminOrderRow } from "@/types/adminOrder";
import { formatDateTimeZh } from "@/lib/formatDateTime";
import { mainContentTableSticky } from "@/lib/tableSticky";
import orderStyles from "./OrderList.module.css";
import styles from "./UserList.module.css";

/** 界面只选日期；GET 由 client 将 `daterange` 展开为 `daterange[0]`/`daterange[1]`，语义与 gold-game POST 里 `daterange: [start,end]` 一致 */
function defaultTodayRange(): [Dayjs, Dayjs] {
  const d = dayjs();
  return [d.startOf("day"), d.startOf("day")];
}

/** 与 Element `value-format="yyyy-MM-dd HH:mm:ss"` 的 daterange 同形状；起止用 dayjs startOf/endOf day */
function rangeToDaterangeStrings(range: [Dayjs, Dayjs]): [string, string] {
  const [from, to] = range;
  return [from.startOf("day").format("YYYY-MM-DD HH:mm:ss"), to.endOf("day").format("YYYY-MM-DD HH:mm:ss")];
}

function statusTag(status: unknown): ReactNode {
  const s = Number(status);
  if (s === 0) {
    return <Tag>未支付</Tag>;
  }
  if (s === 1) {
    return <Tag color="success">已支付</Tag>;
  }
  if (s === 2) {
    return <Tag color="purple">已退款</Tag>;
  }
  return String(status ?? "—");
}

function paymentStatus(status: unknown): string {
  const s = Number(status);
  if (s === 0) {
    return "未支付";
  }
  if (s === 1) {
    return "已支付";
  }
  if (s === 2) {
    return "已退款";
  }
  return "—";
}

function platformLabel(platform: unknown): string {
  const p = Number(platform);
  if (p === 1 || p === 2) {
    return "Airwallex";
  }
  return "Unknown";
}

/** 与 slot `Order.tsx` / `OrderDetail.tsx` 一致：`type === 2` 为续订订单；兼容 string 与其它字段名 */
function isRenewalOrder(row: AdminOrderRow | AdminOrderInfo): boolean {
  const raw = row.type ?? row["order_type"] ?? row["subscription_type"];
  if (raw === 2 || raw === "2") {
    return true;
  }
  const n = Number(raw);
  if (Number.isFinite(n) && n === 2) {
    return true;
  }
  const flag = row["is_renew"] ?? row["renew"] ?? row["is_subscription_renewal"];
  return flag === true || flag === 1 || flag === "1";
}

export function OrderList() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AdminOrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(24);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(() => defaultTodayRange());
  const [orderStatus, setOrderStatus] = useState<string>("");
  const [detailOrderId, setDetailOrderId] = useState<number | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailInfo, setDetailInfo] = useState<AdminOrderInfo | null>(null);
  const searchTimer = useRef<number | null>(null);

  const fetchList = useCallback(async (p: number, kw: string, range: [Dayjs, Dayjs] | null, status: string) => {
    setLoading(true);
    try {
      const kwTrim = kw.trim();
      const q: Record<string, ApiGetQueryValue> = {
        page: p,
        keyword: kwTrim || undefined,
        status: status === "" ? undefined : status,
      };
      if (range != null) {
        q.daterange = rangeToDaterangeStrings(range);
      }
      const res: ApiResult<AdminOrderListPayload> = await apiGet<AdminOrderListPayload>("admin/order", q);
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
    void fetchList(page, keyword, dateRange, orderStatus);
  }, [page, keyword, dateRange, orderStatus, fetchList]);

  useEffect(() => {
    if (detailOrderId == null) {
      setDetailInfo(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailInfo(null);
    void (async () => {
      try {
        const res: ApiResult<AdminOrderInfo> = await apiGet<AdminOrderInfo>("admin/order/info", { id: detailOrderId });
        if (cancelled) {
          return;
        }
        if (res.c !== 0) {
          message.error(res.m || "加载失败");
          setDetailOrderId(null);
          return;
        }
        setDetailInfo(res.d ?? null);
      } catch {
        if (!cancelled) {
          message.error("网络异常");
          setDetailOrderId(null);
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
  }, [detailOrderId]);

  const closeDetail = () => {
    setDetailOrderId(null);
    setDetailInfo(null);
  };

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

  const columns: ColumnsType<AdminOrderRow> = useMemo(
    () => [
      {
        title: "订单ID",
        dataIndex: "id",
        width: 76,
        fixed: "left",
      },
      {
        title: "用户id",
        dataIndex: "user_id",
        width: 96,
        fixed: "left",
        render: (v: unknown) => (
          <div className={orderStyles.userIdCell}>
            <Typography.Text
              className={orderStyles.userIdText}
              copyable={v != null && String(v) !== "" ? { text: String(v) } : false}
            >
              {v != null && String(v) !== "" ? String(v) : "—"}
            </Typography.Text>
          </div>
        ),
      },
      {
        title: "来源",
        dataIndex: "source",
        width: 100,
        ellipsis: true,
        render: (v: unknown) => (
          <Typography.Text ellipsis={v != null && String(v).trim() !== "" ? { tooltip: String(v) } : false}>
            {v != null && String(v).trim() !== "" ? String(v) : "—"}
          </Typography.Text>
        ),
      },
      {
        title: "商品",
        key: "product_amount",
        width: 108,
        render: (_: unknown, record) => {
          const amt = record.amount;
          const amtStr = amt != null && amt !== "" ? `$${String(amt)}` : "—";
          return (
            <div className={styles.timeCell}>
              <div className={styles.timeLine}>
                <Space wrap size={4}>
                  <Typography.Text ellipsis>{String(record.product_name ?? "—")}</Typography.Text>
                  {isRenewalOrder(record) ? <Tag color="lime">续订</Tag> : null}
                </Space>
              </div>
              <div className={styles.timeLine}>
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  {amtStr}
                </Typography.Text>
              </div>
            </div>
          );
        },
      },
      {
        title: "平台订单号",
        dataIndex: "sn",
        width: 180,
        minWidth: 180,
        render: (v: unknown) => (
          <div className={orderStyles.platformSnCell}>
            <Typography.Text copyable={String(v ?? "").trim() ? { text: String(v) } : false}>
              {String(v ?? "—")}
            </Typography.Text>
          </div>
        ),
      },
      {
        title: "状态",
        dataIndex: "status",
        width: 100,
        render: (v: unknown) => statusTag(v),
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
              <span className={styles.timeLabel}>更新时间：</span>
              <span>{formatDateTimeZh(record.updated_at)}</span>
            </div>
          </div>
        ),
      },
      {
        title: "操作",
        key: "actions",
        width: 88,
        fixed: "right",
        render: (_: unknown, record) => (
          <Button
            type="link"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setDetailOrderId(record.id);
            }}
          >
            详情
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        代收记录
      </Typography.Title>

      <div className={orderStyles.filterWrap}>
        <div className={orderStyles.filterBar}>
          <div className={orderStyles.filterItem}>
            <span className={orderStyles.filterLabel}>日期：</span>
            <DatePicker.RangePicker
              className={orderStyles.dateRange}
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
          </div>
          <div className={orderStyles.filterItem}>
            <span className={orderStyles.filterLabel}>订单状态：</span>
            <Select
              value={orderStatus}
              onChange={(v) => {
                setOrderStatus(v ?? "");
                setPage(1);
              }}
              style={{ width: 128 }}
              options={[
                { label: "全部", value: "" },
                { label: "未支付", value: "0" },
                { label: "已支付", value: "1" },
                { label: "已退款", value: "2" },
              ]}
            />
          </div>
          <div className={orderStyles.filterItem}>
            <span className={orderStyles.filterLabel}>关键词：</span>
            <Input
              allowClear
              placeholder="用户 id / 订单号"
              value={keywordInput}
              onChange={(e) => onKeywordChange(e.target.value)}
              style={{ width: 220 }}
              maxLength={32}
            />
          </div>
          <Button
            type="primary"
            onClick={() => {
              const kw = keywordInput.trim();
              setKeyword(kw);
              setPage(1);
              if (page === 1) {
                void fetchList(1, kw, dateRange, orderStatus);
              }
            }}
          >
            搜索
          </Button>
          <span className={orderStyles.totalHint}>共 {total} 条</span>
        </div>
      </div>

      <Table<AdminOrderRow>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={false}
        sticky={mainContentTableSticky}
        scroll={{ x: 1050 }}
        size="middle"
      />

      <div className={styles.paginationWrap}>
        <Pagination
          current={page}
          pageSize={perPage}
          total={total}
          showSizeChanger={false}
          showTotal={(t) => `共 ${t} 条`}
          onChange={(p) => setPage(p)}
        />
      </div>

      <Modal
        title="订单详情"
        open={detailOrderId != null}
        onCancel={closeDetail}
        footer={
          <Button type="primary" onClick={closeDetail}>
            关闭
          </Button>
        }
        width={640}
        destroyOnClose
      >
        {detailOrderId != null && detailLoading ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <Spin size="large" tip="加载中" />
          </div>
        ) : detailInfo ? (
          <>
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              基本信息
            </Typography.Title>
            <Descriptions bordered column={1} size="small" style={{ marginBottom: 24 }}>
              <Descriptions.Item label="订单 ID">{detailInfo.id}</Descriptions.Item>
              <Descriptions.Item label="用户 uid">
                <Typography.Text copyable={{ text: String(detailInfo.user_id ?? "") }}>
                  {String(detailInfo.user_id ?? "—")}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="支付状态">{paymentStatus(detailInfo.status)}</Descriptions.Item>
              <Descriptions.Item label="支付渠道">{platformLabel(detailInfo.platform)}</Descriptions.Item>
              <Descriptions.Item label="金额">{detailInfo.amount != null ? `$${String(detailInfo.amount)}` : "—"}</Descriptions.Item>
              <Descriptions.Item label="退款金额">
                {detailInfo.refund_amount != null ? `$${String(detailInfo.refund_amount)}` : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="订单号">{String(detailInfo.sn ?? "—")}</Descriptions.Item>
              <Descriptions.Item label="订单号（PT）">
                <Typography.Text
                  copyable={String(detailInfo.platform_sn ?? "").trim() ? { text: String(detailInfo.platform_sn) } : false}
                >
                  {String(detailInfo.platform_sn ?? "—")}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="续订">{isRenewalOrder(detailInfo) ? "是" : "否"}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{formatDateTimeZh(detailInfo.created_at)}</Descriptions.Item>
              <Descriptions.Item label="更新时间">{formatDateTimeZh(detailInfo.updated_at)}</Descriptions.Item>
            </Descriptions>

            {detailInfo.billing_status != null && (
              <>
                <Typography.Title level={5}>订阅信息</Typography.Title>
                <Descriptions bordered column={1} size="small">
                  <Descriptions.Item label="续费状态">
                    {Number(detailInfo.billing_status) === 1 ? "已开启" : "已取消"}
                  </Descriptions.Item>
                  <Descriptions.Item label="续费金额">
                    {detailInfo.billing_amount != null ? `$${String(detailInfo.billing_amount)}` : "—"}
                  </Descriptions.Item>
                  <Descriptions.Item label="续费时间">
                    {detailInfo.billing_at ? formatDateTimeZh(detailInfo.billing_at) : "—"}
                  </Descriptions.Item>
                </Descriptions>
              </>
            )}
          </>
        ) : detailOrderId != null ? (
          <Typography.Text type="secondary">暂无数据</Typography.Text>
        ) : null}
      </Modal>
    </div>
  );
}
