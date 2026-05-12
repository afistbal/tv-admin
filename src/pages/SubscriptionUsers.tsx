import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { QuestionCircleOutlined } from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Input,
  Row,
  Select,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import type { ColumnsType } from "antd/es/table";
import { apiPostJson } from "@/api/client";
import type { ApiResult } from "@/api/types";
import type { AdminUserSubscriptionListPayload, AdminUserSubscriptionRow } from "@/types/adminUserSubscription";
import type { SubscriptionPaymentMethodKey } from "@/types/adminStatSubscription";
import { formatDateTimeZh } from "@/lib/formatDateTime";
import orderStyles from "./OrderList.module.css";
import listStyles from "./UserList.module.css";
import styles from "./SubscriptionUsers.module.css";

/** 无值占位（与产品约定一致，ASCII 连字符） */
const EMPTY = "-";

const PAYMENT_METHOD_KEYS: SubscriptionPaymentMethodKey[] = [
  "apple_pay_visa",
  "apple_pay",
  "google_pay_visa",
  "google_pay",
  "visa",
];

function paySvgUrl(file: string): string {
  const base = import.meta.env.BASE_URL;
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return `${prefix}payment/${file}`;
}

function paymentAriaLabel(method: SubscriptionPaymentMethodKey): string {
  switch (method) {
    case "apple_pay_visa":
      return "Apple Pay 与 Visa";
    case "apple_pay":
      return "Apple Pay";
    case "google_pay_visa":
      return "Google Pay 与 Visa";
    case "google_pay":
      return "Google Pay";
    default:
      return "Visa";
  }
}

function isPaymentMethodKey(s: string): s is SubscriptionPaymentMethodKey {
  return (PAYMENT_METHOD_KEYS as readonly string[]).includes(s);
}

function PaymentMethodCell({ method }: { method: SubscriptionPaymentMethodKey }) {
  const showApple = method === "apple_pay_visa" || method === "apple_pay";
  const showGoogle = method === "google_pay_visa" || method === "google_pay";
  const showVisa =
    method === "apple_pay_visa" || method === "google_pay_visa" || method === "visa";

  return (
    <div className={styles.payMethodCell} role="img" aria-label={paymentAriaLabel(method)}>
      <div className={styles.payMethodChips}>
        {showApple ? (
          <img
            src={paySvgUrl("apple-pay.svg")}
            alt=""
            className={styles.payIcon}
            width={54}
            height={18}
            decoding="async"
          />
        ) : null}
        {showGoogle ? (
          <img
            src={paySvgUrl("google-pay.svg")}
            alt=""
            className={styles.payIcon}
            width={64}
            height={18}
            decoding="async"
          />
        ) : null}
        {showVisa ? (
          <img
            src={paySvgUrl("visa.svg")}
            alt=""
            className={styles.payIcon}
            width={52}
            height={18}
            decoding="async"
          />
        ) : null}
      </div>
    </div>
  );
}

function pickPaymentMethodRaw(row: AdminUserSubscriptionRow): string {
  const v =
    row.payment_method ??
    row["paymentMethod"] ??
    row["pay_method"] ??
    row["payment_type"] ??
    row["pay_type"];
  return v != null ? String(v).trim() : "";
}

function cellPaymentMethod(row: AdminUserSubscriptionRow): ReactNode {
  const raw = pickPaymentMethodRaw(row);
  if (raw === "") {
    return EMPTY;
  }
  if (isPaymentMethodKey(raw)) {
    return <PaymentMethodCell method={raw} />;
  }
  return <Typography.Text>{raw}</Typography.Text>;
}

function cellStr(v: unknown): string {
  if (v == null) {
    return EMPTY;
  }
  const s = String(v).trim();
  return s === "" ? EMPTY : s;
}

function cellDatetime(v: unknown): string {
  if (v == null) {
    return EMPTY;
  }
  const s = String(v).trim();
  if (s === "") {
    return EMPTY;
  }
  return formatDateTimeZh(s);
}

function cellBillingAmount(row: AdminUserSubscriptionRow): string {
  const raw = row.billing_amount ?? row.amount;
  if (raw == null) {
    return EMPTY;
  }
  const s = String(raw).trim();
  if (s === "") {
    return EMPTY;
  }
  return `$${s}`;
}

function pickUserId(row: AdminUserSubscriptionRow): string {
  return cellStr(row.user_id);
}

const subscriptionKindTagSx = { marginInlineEnd: 0 } as const;

/**
 * `status === 1`：`is_renewal === 1` → 续订；`0`/缺省 → 首次；其它取值 → 待定。
 * `status !== 1`：一律 待定。
 */
function paymentKindTag(row: AdminUserSubscriptionRow): ReactNode {
  if (Number(row.status) !== 1) {
    return (
      <Tag color="default" style={subscriptionKindTagSx}>
        待定
      </Tag>
    );
  }
  const raw = row.is_renewal ?? row["isRenewal"];
  if (raw === 1 || raw === true || raw === "1") {
    return (
      <Tag color="lime" style={subscriptionKindTagSx}>
        续订
      </Tag>
    );
  }
  if (raw === 0 || raw === false || raw === "0" || raw == null || raw === "") {
    return (
      <Tag color="blue" style={subscriptionKindTagSx}>
        首次
      </Tag>
    );
  }
  return (
    <Tag color="default" style={subscriptionKindTagSx}>
      待定
    </Tag>
  );
}

function defaultDateRange(): [Dayjs, Dayjs] {
  const end = dayjs().startOf("day");
  const start = end.subtract(6, "day");
  return [start, end];
}

function rangeToDaterangeStrings(range: [Dayjs, Dayjs]): [string, string] {
  const [from, to] = range;
  return [from.startOf("day").format("YYYY-MM-DD HH:mm:ss"), to.endOf("day").format("YYYY-MM-DD HH:mm:ss")];
}

/** 与后端 `status` 一致：搜索与列表展示 */
const SUBSCRIPTION_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "0", label: "0 待定" },
  { value: "1", label: "1 成功" },
  { value: "2", label: "2 取消订阅" },
  { value: "3", label: "3 订阅异常（二次扣款第一次失败）" },
  { value: "4", label: "4 订阅异常（二次扣款第二次失败）" },
  { value: "5", label: "5 订阅异常（二次扣款第三次失败）" },
  { value: "10", label: "10 订阅失败（不再执行订阅了）" },
];

function subscriptionStatusMeta(status: unknown): { label: string; color?: string } | null {
  if (status == null || status === "") {
    return null;
  }
  const n = Number(status);
  if (!Number.isFinite(n)) {
    return { label: String(status) };
  }
  switch (n) {
    case 0:
      return { label: "待定", color: "default" };
    case 1:
      return { label: "成功", color: "success" };
    case 2:
      return { label: "取消订阅", color: "processing" };
    case 3:
      return { label: "订阅异常（二次扣款第一次失败）", color: "error" };
    case 4:
      return { label: "订阅异常（二次扣款第二次失败）", color: "error" };
    case 5:
      return { label: "订阅异常（二次扣款第三次失败）", color: "error" };
    case 10:
      return { label: "订阅失败（不再执行订阅了）", color: "magenta" };
    default:
      return { label: String(n) };
  }
}

function statusTag(status: unknown): ReactNode {
  const meta = subscriptionStatusMeta(status);
  if (meta == null) {
    return EMPTY;
  }
  return (
    <Tag color={meta.color} style={{ marginInlineEnd: 0, whiteSpace: "normal", lineHeight: 1.45 }}>
      {meta.label}
    </Tag>
  );
}

export function SubscriptionUsers() {
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>(() => defaultDateRange());
  const [orderStatus, setOrderStatus] = useState<string>("");
  const [rows, setRows] = useState<AdminUserSubscriptionRow[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const searchTimer = useRef<number | null>(null);

  const fetchList = useCallback(async (kw: string, range: [Dayjs, Dayjs], status: string) => {
    setLoading(true);
    try {
      const kwTrim = kw.trim();
      const body: Record<string, unknown> = {
        daterange: rangeToDaterangeStrings(range),
      };
      if (kwTrim !== "") {
        body.keyword = kwTrim;
      }
      if (status !== "") {
        body.status = status;
      }
      const res: ApiResult<AdminUserSubscriptionListPayload> = await apiPostJson<AdminUserSubscriptionListPayload>(
        "admin/user/subscription",
        body,
      );
      if (res.c !== 0) {
        message.error(res.m || "加载失败");
        setRows([]);
        return;
      }
      const d = res.d;
      setRows(Array.isArray(d.data) ? d.data : []);
    } catch {
      message.error("网络异常");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchList(keyword, dateRange, orderStatus);
  }, [keyword, dateRange, orderStatus, fetchList]);

  const onKeywordChange = (v: string) => {
    setKeywordInput(v);
    if (searchTimer.current) {
      window.clearTimeout(searchTimer.current);
    }
    searchTimer.current = window.setTimeout(() => {
      setKeyword(v.trim());
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

  const statSummary = useMemo(() => {
    const uids = rows.map((r) => pickUserId(r)).filter((u) => u !== EMPTY);
    const expectedPay = new Set(uids).size;
    const successUids = new Set(
      rows.filter((r) => Number(r.status) === 1).map((r) => pickUserId(r)).filter((u) => u !== EMPTY),
    );
    const successPay = successUids.size;
    const successRatioPct =
      expectedPay > 0 ? Math.round((successPay / expectedPay) * 1000) / 10 : null;
    const unpaidCount = Math.max(0, expectedPay - successPay);
    return { expectedPay, successPay, successRatioPct, unpaidCount };
  }, [rows]);

  const columns: ColumnsType<AdminUserSubscriptionRow> = useMemo(
    () => [
      {
        title: "订阅 id",
        key: "id",
        width: 96,
        fixed: "left",
        render: (_: unknown, record: AdminUserSubscriptionRow) => cellStr(record.id),
      },
      {
        title: "用户 id",
        key: "user_id",
        width: 120,
        render: (_: unknown, record: AdminUserSubscriptionRow) => {
          const v = pickUserId(record);
          return (
            <div className={orderStyles.userIdCell}>
              <Typography.Text className={orderStyles.userIdText} copyable={v !== EMPTY ? { text: v } : false}>
                {v}
              </Typography.Text>
            </div>
          );
        },
      },
      {
        title: "订单 id",
        key: "order_id",
        width: 120,
        render: (_: unknown, record: AdminUserSubscriptionRow) => {
          const v = cellStr(record.order_id);
          return (
            <div className={orderStyles.userIdCell}>
              <Typography.Text className={orderStyles.userIdText} copyable={v !== EMPTY ? { text: v } : false}>
                {v}
              </Typography.Text>
            </div>
          );
        },
      },
      {
        title: "状态",
        key: "status",
        width: 260,
        render: (_: unknown, record: AdminUserSubscriptionRow) => statusTag(record.status),
      },
      {
        title: "付款方式",
        key: "payment_method",
        width: 200,
        render: (_: unknown, record: AdminUserSubscriptionRow) => cellPaymentMethod(record),
      },
      {
        title: "扣费金额",
        key: "billing_amount",
        width: 110,
        render: (_: unknown, record: AdminUserSubscriptionRow) => cellBillingAmount(record),
      },
      {
        title: "时间",
        key: "time",
        width: 260,
        render: (_: unknown, record: AdminUserSubscriptionRow) => (
          <div className={listStyles.timeCell}>
            <div className={listStyles.timeLine}>
              <span className={listStyles.timeLabel}>订阅：</span>
              {paymentKindTag(record)}
            </div>
            <div className={listStyles.timeLine}>
              <span className={listStyles.timeLabel}>创建时间：</span>
              <span>{cellDatetime(record.created_at)}</span>
            </div>
            <div className={listStyles.timeLine}>
              <span className={listStyles.timeLabel}>到期时间：</span>
              <span>{cellDatetime(record.billing_at)}</span>
            </div>
          </div>
        ),
      },
      {
        title: "平台订单号",
        key: "platform_sn",
        width: 280,
        ellipsis: false,
        render: (_: unknown, record: AdminUserSubscriptionRow) => {
          const s = cellStr(record.platform_sn);
          if (s === EMPTY) {
            return EMPTY;
          }
          return (
            <div className={orderStyles.platformSnCell}>
              <Typography.Text copyable={{ text: s }}>{s}</Typography.Text>
            </div>
          );
        },
      },
    ],
    [],
  );

  const rowKey = (row: AdminUserSubscriptionRow) =>
    String(row.id ?? `${row.user_id ?? ""}_${row.platform_sn ?? ""}_${row.order_id ?? ""}`);

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        订阅用户
      </Typography.Title>

      <div className={orderStyles.filterWrap}>
        <div className={orderStyles.filterBar}>
          <div className={orderStyles.filterItem}>
            <span className={orderStyles.filterLabel}>关键词：</span>
            <Input
              allowClear
              placeholder="用户 id / 订单号等"
              value={keywordInput}
              onChange={(e) => onKeywordChange(e.target.value)}
              style={{ width: 220 }}
              maxLength={64}
            />
          </div>
          <div className={orderStyles.filterItem}>
            <span className={orderStyles.filterLabel}>日期：</span>
            <DatePicker.RangePicker
              className={orderStyles.dateRange}
              format="YYYY-MM-DD"
              allowClear={false}
              value={dateRange}
              onChange={(dates) => {
                if (dates?.[0] && dates[1]) {
                  let a = dates[0].startOf("day");
                  let b = dates[1].startOf("day");
                  if (a.isAfter(b)) {
                    const t = a;
                    a = b;
                    b = t;
                  }
                  setDateRange([a, b]);
                }
              }}
            />
          </div>
          <div className={orderStyles.filterItem}>
            <span className={orderStyles.filterLabel}>状态：</span>
            <Select
              value={orderStatus}
              onChange={(v) => {
                setOrderStatus(v ?? "");
              }}
              style={{ width: 320 }}
              popupMatchSelectWidth={false}
              options={[{ label: "全部", value: "" }, ...SUBSCRIPTION_STATUS_OPTIONS]}
            />
          </div>
          <Button
            type="primary"
            onClick={() => {
              const kw = keywordInput.trim();
              setKeyword(kw);
              void fetchList(kw, dateRange, orderStatus);
            }}
          >
            搜索
          </Button>
          <span className={orderStyles.totalHint}>共 {rows.length} 条</span>
        </div>
      </div>

      <Card size="small" className={styles.statCards}>
        <Row gutter={[24, 16]}>
          <Col xs={24} sm={8}>
            <Statistic title="列表用户数" value={statSummary.expectedPay} />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic
              title={
                <span className={styles.statTitleInline}>
                  <span>成功</span>
                  {statSummary.successRatioPct != null ? (
                    <Typography.Text type="success" className={styles.statTitleRatio}>
                      {statSummary.successRatioPct}%
                    </Typography.Text>
                  ) : null}
                </span>
              }
              value={statSummary.successPay}
            />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic
              title={
                <span className={styles.statTitleInline}>
                  <span>其他</span>
                  <Tooltip title="当前列表去重：用户数 − 状态为「成功」的人数（含待定、取消、异常、失败等）">
                    <QuestionCircleOutlined className={styles.statTitleHintIcon} aria-label="说明" />
                  </Tooltip>
                </span>
              }
              value={statSummary.unpaidCount}
            />
          </Col>
        </Row>
      </Card>

      <Table<AdminUserSubscriptionRow>
        rowKey={rowKey}
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={false}
        scroll={{ x: 1660 }}
        size="middle"
        locale={{ emptyText: loading ? "加载中…" : "暂无数据" }}
      />
    </div>
  );
}
