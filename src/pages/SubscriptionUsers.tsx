import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { QuestionCircleOutlined } from "@ant-design/icons";
import { Button, Card, Col, DatePicker, Row, Select, Space, Statistic, Table, Tag, Tooltip, Typography } from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import type { ColumnsType } from "antd/es/table";
import type { SubscriptionPaymentMethodKey, SubscriptionUserRow } from "@/types/adminStatSubscription";
import { formatDateTimeZh } from "@/lib/formatDateTime";
import orderStyles from "./OrderList.module.css";
import listStyles from "./UserList.module.css";
import styles from "./SubscriptionUsers.module.css";

/** 假数据支付方式：含 Apple Pay / Google Pay 单独或与 Visa 组合 */
const PAYMENT_METHOD_KEYS: SubscriptionPaymentMethodKey[] = [
  "apple_pay_visa",
  "apple_pay",
  "google_pay_visa",
  "google_pay",
  "visa",
];

/** 假数据商品：结构与代收页「商品」列一致（名称 + 金额）；接口就绪后对齐 `product_name` / `amount` */
const MOCK_PRODUCT_ROWS = [
  { name: "VIP Weekly", amount: "7.99" },
  { name: "VIP Monthly", amount: "19.99" },
  { name: "VIP Quarterly", amount: "49.99" },
  { name: "VIP Annual", amount: "99.99" },
  { name: "Drama Full Unlock", amount: "12.99" },
  { name: "Episode Bundle ×12", amount: "5.99" },
] as const;

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

/** 仅展示品牌图（`public/payment/*.svg`），无额外文案 */
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

/** 稳定伪随机 [0, max) */
function rnd(seed: number, max: number): number {
  let x = seed >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return (x >>> 0) % max;
}

function mockIsoOnDay(day: Dayjs, seed: number, hour: number, minute: number): string {
  const second = rnd(seed + 11, 60);
  return day.hour(hour).minute(minute).second(second).millisecond(0).toISOString();
}

/** 默认近 7 个自然日（含今日）：起 = 今日-6，止 = 今日 */
function defaultDateRange(): [Dayjs, Dayjs] {
  const end = dayjs().startOf("day");
  const start = end.subtract(6, "day");
  return [start, end];
}

/**
 * 按所选日期段逐日生成假数据（含起止自然日）；接口就绪后对齐 `daterange`。
 */
function buildMockRows(range: [Dayjs, Dayjs], statusFilter: string): SubscriptionUserRow[] {
  let startDay = range[0].startOf("day");
  let endDay = range[1].startOf("day");
  if (startDay.isAfter(endDay)) {
    const t = startDay;
    startDay = endDay;
    endDay = t;
  }

  const out: SubscriptionUserRow[] = [];
  let seq = 0;

  for (let d = startDay; !d.isAfter(endDay); d = d.add(1, "day")) {
    const dayStr = d.format("YYYY-MM-DD");
    const daySeed = d.year() * 400 + d.month() * 40 + d.date();
    const nRows = 4 + rnd(daySeed, 5);

    for (let i = 0; i < nRows; i++) {
      seq += 1;
      const seed = daySeed * 100 + i * 17 + seq;
      const roll = rnd(seed, 100);
      let status: 0 | 1 | 2 | 3;
      if (roll < 38) {
        status = 0;
      } else if (roll < 73) {
        status = 1;
      } else if (roll < 88) {
        status = 2;
      } else {
        status = 3;
      }

      if (statusFilter !== "" && String(status) !== statusFilter) {
        continue;
      }

      const paymentMethod = PAYMENT_METHOD_KEYS[rnd(seed + 3, PAYMENT_METHOD_KEYS.length)];
      const uid = `${8000000 + rnd(seed, 900000)}`;
      const prod = MOCK_PRODUCT_ROWS[rnd(seed + 5, MOCK_PRODUCT_ROWS.length)];
      const isRenewal = rnd(seed + 7, 100) < 30;

      let pendingBillingTime: string | null = null;
      let billingTime: string | null = null;
      let platformSn: string | null = null;

      if (status === 0) {
        pendingBillingTime = mockIsoOnDay(d, seed, 10 + rnd(seed, 8), rnd(seed + 2, 60));
      } else if (status === 1) {
        billingTime = mockIsoOnDay(d, seed, 6 + rnd(seed, 12), rnd(seed + 4, 60));
        platformSn = `PT_${dayStr.replace(/-/g, "")}_${uid}_${rnd(seed, 99999)}`;
      } else if (status === 2) {
        billingTime = mockIsoOnDay(d, seed, 14, rnd(seed + 1, 60));
      } else {
        billingTime = mockIsoOnDay(d, seed, 9 + rnd(seed, 6), rnd(seed + 8, 60));
        platformSn = `FL_${dayStr.replace(/-/g, "")}_${uid}_${rnd(seed + 9, 99999)}`;
      }

      out.push({
        key: `sub_${dayStr}_${seq}`,
        uid,
        productName: prod.name,
        amount: prod.amount,
        ...(isRenewal ? { isRenewal: true } : {}),
        status,
        paymentMethod,
        pendingBillingTime,
        billingTime,
        platformSn,
      });
    }
  }

  /** 新记录靠前：按扣费/待扣费时间倒序，缺省放后 */
  const timeKey = (r: SubscriptionUserRow) =>
    r.billingTime ?? r.pendingBillingTime ?? "1970-01-01T00:00:00.000Z";
  out.sort((a, b) => (timeKey(a) < timeKey(b) ? 1 : timeKey(a) > timeKey(b) ? -1 : 0));

  return out;
}

function statusTag(status: SubscriptionUserRow["status"]): ReactNode {
  if (status === 0) {
    return <Tag>未支付</Tag>;
  }
  if (status === 1) {
    return <Tag color="success">已支付</Tag>;
  }
  if (status === 2) {
    return <Tag color="purple">已退款</Tag>;
  }
  return <Tag color="error">扣费失败</Tag>;
}

export function SubscriptionUsers() {
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>(() => defaultDateRange());
  const [orderStatus, setOrderStatus] = useState<string>("");
  const [rows, setRows] = useState<SubscriptionUserRow[]>([]);

  const loadMock = useCallback(() => {
    setLoading(true);
    window.setTimeout(() => {
      setRows(buildMockRows(dateRange, orderStatus));
      setLoading(false);
    }, 100);
  }, [dateRange, orderStatus]);

  useEffect(() => {
    loadMock();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅挂载拉取；改条件请点「搜索」
  }, []);

  const statSummary = useMemo(() => {
    const allUids = rows.map((r) => r.uid);
    const expectedPay = new Set(allUids).size;
    const successUids = new Set(rows.filter((r) => r.status === 1).map((r) => r.uid));
    const successPay = successUids.size;
    const successRatioPct =
      expectedPay > 0 ? Math.round((successPay / expectedPay) * 1000) / 10 : null;
    const unpaidCount = Math.max(0, expectedPay - successPay);
    return { expectedPay, successPay, successRatioPct, unpaidCount };
  }, [rows]);

  const columns: ColumnsType<SubscriptionUserRow> = useMemo(
    () => [
      {
        title: "用户 id",
        dataIndex: "uid",
        key: "uid",
        width: 148,
        fixed: "left",
        render: (v: string) => (
          <div className={orderStyles.userIdCell}>
            <Typography.Text className={orderStyles.userIdText} copyable={v ? { text: String(v) } : false}>
              {v ?? "—"}
            </Typography.Text>
          </div>
        ),
      },
      {
        title: "产品",
        key: "product",
        width: 160,
        render: (_: unknown, record: SubscriptionUserRow) => {
          const amtStr =
            record.amount != null && String(record.amount).trim() !== ""
              ? `$${String(record.amount)}`
              : "—";
          return (
            <div className={listStyles.timeCell}>
              <div className={listStyles.timeLine}>
                <Space wrap size={4}>
                  <Typography.Text ellipsis>{record.productName ?? "—"}</Typography.Text>
                  {record.isRenewal ? <Tag color="lime">续订</Tag> : null}
                </Space>
              </div>
              <div className={listStyles.timeLine}>
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  {amtStr}
                </Typography.Text>
              </div>
            </div>
          );
        },
      },
      {
        title: "状态",
        dataIndex: "status",
        key: "status",
        width: 108,
        render: (s: SubscriptionUserRow["status"]) => statusTag(s),
      },
      {
        title: "支付方式",
        dataIndex: "paymentMethod",
        key: "paymentMethod",
        width: 220,
        render: (m: SubscriptionPaymentMethodKey) => <PaymentMethodCell method={m} />,
      },
      {
        title: "时间",
        key: "time",
        width: 220,
        render: (_: unknown, record: SubscriptionUserRow) => {
          const billingDisplay =
            record.billingTime != null && String(record.billingTime).trim() !== ""
              ? formatDateTimeZh(record.billingTime)
              : "—";
          const pendingDisplay =
            record.pendingBillingTime != null && String(record.pendingBillingTime).trim() !== ""
              ? formatDateTimeZh(record.pendingBillingTime)
              : "—";
          return (
            <div className={listStyles.timeCell}>
              <div className={listStyles.timeLine}>
                <span className={listStyles.timeLabel}>扣费时间：</span>
                <span>{billingDisplay}</span>
              </div>
              <div className={listStyles.timeLine}>
                <span className={listStyles.timeLabel}>待扣费时间：</span>
                <span>{pendingDisplay}</span>
              </div>
            </div>
          );
        },
      },
      {
        title: "平台订单号",
        dataIndex: "platformSn",
        key: "platformSn",
        width: 260,
        ellipsis: false,
        render: (v: string | null) => {
          const s = v != null && String(v).trim() !== "" ? String(v) : "";
          if (!s) {
            return "—";
          }
          return (
            <div className={orderStyles.platformSnCell}>
              <Typography.Text copyable={{ text: s }}>{s}</Typography.Text>
            </div>
          );
        },
      },
    ],
    [styles],
  );

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        订阅用户
      </Typography.Title>

      <div className={orderStyles.filterWrap}>
        <div className={orderStyles.filterBar}>
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
            <span className={orderStyles.filterLabel}>订单状态：</span>
            <Select
              value={orderStatus}
              onChange={(v) => setOrderStatus(v ?? "")}
              style={{ width: 128 }}
              options={[
                { label: "全部", value: "" },
                { label: "未支付", value: "0" },
                { label: "已支付", value: "1" },
                { label: "已退款", value: "2" },
                { label: "扣费失败", value: "3" },
              ]}
            />
          </div>
          <Button type="primary" onClick={() => loadMock()}>
            搜索
          </Button>
        </div>
      </div>

      <Card size="small" className={styles.statCards}>
        <Row gutter={[24, 16]}>
          <Col xs={24} sm={8}>
            <Statistic title="应支付人数" value={statSummary.expectedPay} />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic
              title={
                <span className={styles.statTitleInline}>
                  <span>支付成功</span>
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
                  <span>未支付</span>
                  <Tooltip title="应支付人数 − 支付成功人数">
                    <QuestionCircleOutlined className={styles.statTitleHintIcon} aria-label="说明" />
                  </Tooltip>
                </span>
              }
              value={statSummary.unpaidCount}
            />
          </Col>
        </Row>
      </Card>

      <Table<SubscriptionUserRow>
        rowKey="key"
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={false}
        scroll={{ x: 1260 }}
        size="middle"
        locale={{ emptyText: loading ? "加载中…" : "暂无数据" }}
      />
    </div>
  );
}
