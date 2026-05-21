import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BellOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  FilterOutlined,
  MenuOutlined,
  PayCircleOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  Button,
  DatePicker,
  Input,
  Modal,
  Segmented,
  Select,
  Pagination,
  Spin,
  Table,
  Tooltip,
  Typography,
  message,
} from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import type { ColumnsType } from "antd/es/table";
import { apiPostJson, getApiErrorMessage, isApiResultOk } from "@/api/client";
import type { ApiResult } from "@/api/types";
import { NotionTag } from "@/components/NotionTag";
import { SubscriptionRenewalStatCards } from "@/components/SubscriptionRenewalStatCards";

const SubscriptionUsersCalendar = lazy(() =>
  import("@/components/SubscriptionUsersCalendar").then((m) => ({ default: m.SubscriptionUsersCalendar })),
);
import type {
  AdminUserSubscriptionListPayload,
  AdminUserSubscriptionRow,
  AdminUserSubscriptionStat,
} from "@/types/adminUserSubscription";
import { buildSubscriptionRenewalStatRows } from "@/lib/subscriptionRenewalStat";
import {
  SUBSCRIPTION_DEFAULT_ORDER_BY,
  SUBSCRIPTION_LIST_PAGE_SIZE,
  SUBSCRIPTION_PAY_COUNT_OPTIONS,
  SUBSCRIPTION_PRODUCT_OPTIONS,
  SUBSCRIPTION_TIME_TYPE_OPTIONS,
  buildSubscriptionListBody,
  orderByToSortOrder,
  subscriptionDateRangePresets,
  tableSorterToOrderBy,
  type SubscriptionListQuery,
  type SubscriptionTimeType,
} from "@/lib/subscriptionListFilters";
import { useAuth } from "@/auth/AuthContext";
import { isAdminUser } from "@/auth/userInfo";
import {
  EMPTY,
  billingRemainingDays,
  channelTone,
  countSubscriptionPageStatus,
  cycleCount,
  formatCnDateTime,
  subscriptionPaySuccessCount,
  paymentMethodTone,
  productTypeTone,
  rowStableKey,
  SUBSCRIPTION_ORDER_STATUS_FILTER_OPTIONS,
  subscriptionOrderStatusTone,
} from "@/lib/subscriptionUserDisplay";
import { mainContentTableSticky } from "@/lib/tableSticky";
import orderStyles from "./OrderList.module.css";
import styles from "./SubscriptionUsers.module.css";
import userListStyles from "./UserList.module.css";

type ViewMode = "calendar" | "table";

/** 各列 width 之和，与 columns 保持一致，避免表头/表体横向错位 */
const SUBSCRIPTION_TABLE_SCROLL_X =
  108 + 176 + 220 + 108 + 148 + 112 + 108 + 88 + 128;

function cellStr(v: unknown): string {
  if (v == null) {
    return EMPTY;
  }
  const s = String(v).trim();
  return s === "" ? EMPTY : s;
}

export function SubscriptionUsers() {
  const { user } = useAuth();
  const canCancelSubscription = user != null && isAdminUser(user);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [orderBy, setOrderBy] = useState(SUBSCRIPTION_DEFAULT_ORDER_BY);
  const [calendarMonth, setCalendarMonth] = useState(() => dayjs().startOf("month"));
  const [orderStatus, setOrderStatus] = useState<string>("");
  const [apiRows, setApiRows] = useState<AdminUserSubscriptionRow[]>([]);
  const [listCount, setListCount] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(SUBSCRIPTION_LIST_PAGE_SIZE);
  const [subscriptionStat, setSubscriptionStat] = useState<AdminUserSubscriptionStat | null>(null);
  const [userIdInput, setUserIdInput] = useState("");
  const [userId, setUserId] = useState("");
  const [timeType, setTimeType] = useState<SubscriptionTimeType>("created_at");
  const [productId, setProductId] = useState<string>("");
  const [channelInput, setChannelInput] = useState("");
  const [channel, setChannel] = useState("");
  const [payCount, setPayCount] = useState<string>("");
  const searchTimer = useRef<number | null>(null);
  const channelSearchTimer = useRef<number | null>(null);

  const listQuery = useMemo<SubscriptionListQuery>(
    () => ({
      userId,
      range: dateRange,
      status: orderStatus,
      timeType,
      productId,
      channel,
      payCount,
      orderBy,
      page,
    }),
    [userId, dateRange, orderStatus, timeType, productId, channel, payCount, orderBy, page],
  );

  const fetchList = useCallback(async (q: SubscriptionListQuery) => {
    setLoading(true);
    try {
      const body = buildSubscriptionListBody(q);
      const res: ApiResult<AdminUserSubscriptionListPayload> = await apiPostJson<AdminUserSubscriptionListPayload>(
        "admin/user/subscription",
        body,
      );
      if (res.c !== 0) {
        message.error(res.m || "加载失败");
        setApiRows([]);
        setListCount(0);
        setSubscriptionStat(null);
        return;
      }
      const d = res.d;
      setApiRows(Array.isArray(d.data) ? d.data : []);
      setListCount(Number(d.count) || 0);
      setPerPage(Number(d.per_page) || SUBSCRIPTION_LIST_PAGE_SIZE);
      setPage(Number(d.current_page) || q.page);
      setSubscriptionStat(d.stat ?? null);
    } catch {
      message.error("网络异常");
      setApiRows([]);
      setListCount(0);
      setSubscriptionStat(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchList(listQuery);
  }, [listQuery, fetchList]);

  useEffect(() => {
    setCalendarMonth((dateRange?.[0] ?? dayjs()).startOf("month"));
  }, [dateRange]);

  const onUserIdChange = (v: string) => {
    setUserIdInput(v);
    if (searchTimer.current) {
      window.clearTimeout(searchTimer.current);
    }
    searchTimer.current = window.setTimeout(() => {
      setUserId(v.trim());
      setPage(1);
    }, 400);
  };

  const onChannelChange = (v: string) => {
    setChannelInput(v);
    if (channelSearchTimer.current) {
      window.clearTimeout(channelSearchTimer.current);
    }
    channelSearchTimer.current = window.setTimeout(() => {
      setChannel(v.trim());
      setPage(1);
    }, 400);
  };

  const runSearch = useCallback(() => {
    const uid = userIdInput.trim();
    const ch = channelInput.trim();
    setUserId(uid);
    setChannel(ch);
    setPage(1);
    void fetchList({
      userId: uid,
      range: dateRange,
      status: orderStatus,
      timeType,
      productId,
      channel: ch,
      payCount,
      orderBy,
      page: 1,
    });
  }, [userIdInput, channelInput, dateRange, orderStatus, timeType, productId, payCount, orderBy, fetchList]);

  const requestCancelSubscription = useCallback(() => {
    Modal.confirm({
      title: "确认取消订阅？",
      content: "将调用取消订阅接口，订阅状态会变为「取消订阅」。是否继续？",
      okText: "确认",
      cancelText: "返回",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const res: ApiResult<unknown> = await apiPostJson("subscription/cancel", {});
          if (!isApiResultOk(res)) {
            message.error(getApiErrorMessage(res, "操作失败"));
            return Promise.reject(new Error("fail"));
          }
          message.success(typeof res.m === "string" && res.m.trim() ? res.m.trim() : "已取消订阅");
          void fetchList(listQuery);
        } catch {
          message.error("网络异常");
          return Promise.reject(new Error("network"));
        }
      },
    });
  }, [fetchList, listQuery]);

  useEffect(
    () => () => {
      if (searchTimer.current) {
        window.clearTimeout(searchTimer.current);
      }
      if (channelSearchTimer.current) {
        window.clearTimeout(channelSearchTimer.current);
      }
    },
    [],
  );

  const renewalStatRows = useMemo(
    () => buildSubscriptionRenewalStatRows(listCount, subscriptionStat),
    [listCount, subscriptionStat],
  );

  const pageStatusCounts = useMemo(() => countSubscriptionPageStatus(apiRows), [apiRows]);

  const columns: ColumnsType<AdminUserSubscriptionRow> = useMemo(
    () => [
      {
        title: (
          <span className={styles.colTitle}>
            <MenuOutlined className={styles.colIcon} />
            用户 Id
          </span>
        ),
        key: "user_id",
        width: 108,
        fixed: "left",
        className: styles.notionCell,
        render: (_: unknown, record) => {
          const v = cellStr(record.user_id);
          return (
            <Typography.Text className={styles.plainText} copyable={v !== EMPTY ? { text: v } : false}>
              {v}
            </Typography.Text>
          );
        },
      },
      {
        title: (
          <span className={styles.colTitle}>
            <CalendarOutlined className={styles.colIcon} />
            开始订阅时间
          </span>
        ),
        key: "created_at",
        dataIndex: "created_at",
        width: 176,
        sorter: true,
        sortOrder: orderByToSortOrder(orderBy, "created_at"),
        className: styles.notionCell,
        render: (_: unknown, record) => (
          <span className={styles.plainText}>{formatCnDateTime(record.created_at)}</span>
        ),
      },
      {
        title: (
          <span className={styles.colTitle}>
            <BellOutlined className={styles.colIcon} />
            当前周期结束时间
          </span>
        ),
        key: "billing_at",
        dataIndex: "billing_at",
        width: 220,
        sorter: true,
        sortOrder: orderByToSortOrder(orderBy, "billing_at"),
        className: styles.notionCell,
        render: (_: unknown, record) => {
          const time = formatCnDateTime(record.billing_at);
          const remaining = billingRemainingDays(record);
          return (
            <span className={styles.plainText}>
              {time}
              {remaining != null ? (
                <span className={styles.billingRemaining}> · 剩余{remaining}天</span>
              ) : null}
            </span>
          );
        },
      },
      {
        title: (
          <span className={styles.colTitle}>
            <ReloadOutlined className={styles.colIcon} />
            订阅类型
          </span>
        ),
        key: "product_id",
        width: 108,
        className: styles.notionCell,
        render: (_: unknown, record) => <NotionTag tone={productTypeTone(record)} />,
      },
      {
        title: (
          <span className={styles.colTitle}>
            <ClockCircleOutlined className={styles.colIcon} />
            状态
          </span>
        ),
        key: "status",
        width: 148,
        className: `${styles.notionCell} ${styles.statusCell}`,
        render: (_: unknown, record) => (
          <NotionTag wrap tone={subscriptionOrderStatusTone(record)} />
        ),
      },
      {
        title: (
          <span className={styles.colTitle}>
            <ClockCircleOutlined className={styles.colIcon} />
            订阅次数
          </span>
        ),
        key: "subscription_count",
        width: 112,
        className: styles.notionCell,
        render: (_: unknown, record) => (
          <div className={styles.subscriptionCountCell}>
            <div className={styles.subscriptionCountLineSuccess}>
              <span className={styles.subscriptionCountLabel}>成功次数：</span>
              <span className={styles.subscriptionCountValue}>{subscriptionPaySuccessCount(record)}</span>
            </div>
            <div className={styles.subscriptionCountLineCycle}>
              <span className={styles.subscriptionCountLabel}>周期次数：</span>
              <span className={styles.subscriptionCountValue}>{cycleCount(record)}</span>
            </div>
          </div>
        ),
      },
      {
        title: (
          <span className={styles.colTitle}>
            <FilterOutlined className={styles.colIcon} />
            投放渠道
          </span>
        ),
        key: "channel",
        width: 108,
        className: `${styles.notionCell} ${styles.channelCell}`,
        render: (_: unknown, record) => {
          const tone = channelTone(record);
          return tone ? <NotionTag wrap tone={tone} /> : <span className={styles.plainText}>{EMPTY}</span>;
        },
      },
      {
        title: (
          <span className={styles.colTitle}>
            <FilterOutlined className={styles.colIcon} />
            国家
          </span>
        ),
        key: "country",
        width: 88,
        className: styles.notionCell,
        render: (_: unknown, record) => <span className={styles.plainText}>{cellStr(record.country)}</span>,
      },
      {
        title: (
          <span className={styles.colTitle}>
            <PayCircleOutlined className={styles.colIcon} />
            付费方式
          </span>
        ),
        key: "payment_method",
        width: 128,
        className: styles.notionCell,
        render: (_: unknown, record) => {
          const tone = paymentMethodTone(record);
          return tone ? <NotionTag tone={tone} /> : <span className={styles.plainText}>{EMPTY}</span>;
        },
      },
    ],
    [orderBy],
  );

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <Typography.Title level={4} className={styles.pageTitle}>
          订阅用户
        </Typography.Title>
        <div className={styles.pageHeadRight}>
          {canCancelSubscription ? (
            <Button danger size="small" onClick={requestCancelSubscription}>
              取消订阅
            </Button>
          ) : null}
          <span className={styles.totalHint}>共 {listCount} 条</span>
        </div>
      </div>

      <div className={styles.viewBar}>
        <Segmented<ViewMode>
          value={viewMode}
          onChange={(v) => setViewMode(v as ViewMode)}
          options={[
            { label: "日历视图", value: "calendar" },
            { label: "表格", value: "table" },
          ]}
        />
      </div>

      <div className={orderStyles.filterWrap}>
        <div className={orderStyles.filterBar}>
          <div className={orderStyles.filterItem}>
            <span className={orderStyles.filterLabel}>时间字段</span>
            <Select<SubscriptionTimeType>
              className={styles.timeTypeField}
              value={timeType}
              onChange={(v) => {
                setTimeType(v);
                setPage(1);
              }}
              options={SUBSCRIPTION_TIME_TYPE_OPTIONS}
            />
          </div>
          <div className={orderStyles.filterItem}>
            <span className={orderStyles.filterLabel}>日期</span>
            <DatePicker.RangePicker
              className={orderStyles.dateRange}
              picker="date"
              format="YYYY-MM-DD"
              allowClear
              value={dateRange}
              presets={subscriptionDateRangePresets()}
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
                  setPage(1);
                } else {
                  setDateRange(null);
                  setPage(1);
                }
              }}
            />
          </div>
          <div className={orderStyles.filterItem}>
            <span className={orderStyles.filterLabel}>产品</span>
            <Select
              className={styles.productField}
              value={productId}
              onChange={(v) => {
                setProductId(v ?? "");
                setPage(1);
              }}
              popupMatchSelectWidth={false}
              options={SUBSCRIPTION_PRODUCT_OPTIONS}
            />
          </div>
          <div className={orderStyles.filterItem}>
            <span className={orderStyles.filterLabel}>状态</span>
            <Select
              className={styles.statusField}
              value={orderStatus}
              onChange={(v) => {
                setOrderStatus(v ?? "");
                setPage(1);
              }}
              popupMatchSelectWidth={false}
              options={[{ label: "全部", value: "" }, ...SUBSCRIPTION_ORDER_STATUS_FILTER_OPTIONS]}
            />
          </div>
          <div className={orderStyles.filterItem}>
            <span className={orderStyles.filterLabel}>订阅成功次数</span>
            <Select
              allowClear
              className={styles.payCountField}
              placeholder="请选择"
              value={payCount === "" ? undefined : payCount}
              onChange={(v) => {
                setPayCount(v ?? "");
                setPage(1);
              }}
              popupMatchSelectWidth={false}
              options={SUBSCRIPTION_PAY_COUNT_OPTIONS}
            />
          </div>
          <div className={orderStyles.filterItem}>
            <span className={orderStyles.filterLabel}>投放渠道</span>
            <Input
              allowClear
              className={styles.channelField}
              placeholder="渠道码"
              value={channelInput}
              onChange={(e) => onChannelChange(e.target.value)}
              maxLength={64}
            />
          </div>
          <div className={orderStyles.filterItem}>
            <span className={orderStyles.filterLabel}>用户 id</span>
            <Input
              allowClear
              className={styles.userIdField}
              placeholder="用户 id"
              value={userIdInput}
              onChange={(e) => onUserIdChange(e.target.value)}
              maxLength={64}
            />
          </div>
          <Button type="primary" onClick={runSearch}>
            搜索
          </Button>
          <Tooltip title="daterange 与 timeType 搭配；timeType 为 created_at 或 updated_at">
            <QuestionCircleOutlined className={styles.filterHelp} />
          </Tooltip>
        </div>
      </div>

      <section className={styles.statSection}>
        <div className={styles.statSectionHead}>
          <Typography.Text className={styles.statSectionTitle}>续订统计</Typography.Text>
          <span className={styles.statPageSummary}>
            <span className={styles.statPageSuccess}>
              本页成功：<strong>{pageStatusCounts.success}</strong>
            </span>
            <span className={styles.statPageFail}>
              失败：<strong>{pageStatusCounts.fail}</strong>
            </span>
          </span>
        </div>
        <SubscriptionRenewalStatCards rows={renewalStatRows} loading={loading} />
      </section>

      {viewMode === "calendar" ? (
        <Spin spinning={loading}>
          <Suspense fallback={<div className={styles.calendarLoading}>加载日历…</div>}>
            <SubscriptionUsersCalendar rows={apiRows} month={calendarMonth} onMonthChange={setCalendarMonth} />
          </Suspense>
        </Spin>
      ) : (
        <Table<AdminUserSubscriptionRow>
          rowKey={rowStableKey}
          loading={loading}
          columns={columns}
          dataSource={apiRows}
          pagination={false}
          scroll={{ x: SUBSCRIPTION_TABLE_SCROLL_X }}
          size="middle"
          tableLayout="fixed"
          className={styles.notionTable}
          bordered
          showHeader
          sticky={mainContentTableSticky}
          locale={{ emptyText: loading ? "加载中…" : "暂无数据" }}
          onChange={(_pagination, _filters, sorter) => {
            const s = Array.isArray(sorter) ? sorter[0] : sorter;
            const field = String(s?.columnKey ?? s?.field ?? "");
            if (field === "created_at" || field === "billing_at") {
              setOrderBy(tableSorterToOrderBy(sorter, field));
            } else {
              setOrderBy("");
            }
            setPage(1);
          }}
        />
      )}

      {listCount > SUBSCRIPTION_LIST_PAGE_SIZE ? (
        <div className={userListStyles.paginationWrap}>
          <Pagination
            current={page}
            pageSize={perPage}
            total={listCount}
            showSizeChanger={false}
            showTotal={(t) => `共 ${t} 条`}
            onChange={(p) => setPage(p)}
          />
        </div>
      ) : null}
    </div>
  );
}
