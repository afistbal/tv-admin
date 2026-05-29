import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BellOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  EditOutlined,
  FilterOutlined,
  MenuOutlined,
  PayCircleOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import {
  Button,
  DatePicker,
  Form,
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
import { OrderPaymentMethodDisplay } from "@/components/OrderPaymentMethodDisplay";
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
import { resolveSubscriptionPaymentMethodDisplay } from "@/lib/orderPaymentDetailDisplay";
import { useAuth } from "@/auth/AuthContext";
import { isAdminUser } from "@/auth/userInfo";
import {
  EMPTY,
  billingRemainingDays,
  pickOpTime,
  channelTone,
  countSubscriptionPageStatus,
  cycleCount,
  formatCnDateTime,
  subscriptionPaySuccessCount,
  productTypeTone,
  rowStableKey,
  SUBSCRIPTION_ORDER_STATUS_FILTER_OPTIONS,
  SUBSCRIPTION_STATUS_EDIT_OPTIONS,
  subscriptionOrderStatusTone,
} from "@/lib/subscriptionUserDisplay";
import { mainContentTableSticky } from "@/lib/tableSticky";
import orderStyles from "./OrderList.module.css";
import styles from "./SubscriptionUsers.module.css";
import userListStyles from "./UserList.module.css";

type ViewMode = "calendar" | "table";

/** 各列 width 之和，与 columns 保持一致，避免表头/表体横向错位（含复选框列约 48px） */
const SUBSCRIPTION_TABLE_SCROLL_X =
  48 + 88 + 108 + 176 + 220 + 108 + 168 + 100 + 112 + 108 + 160;

function cellStr(v: unknown): string {
  if (v == null) {
    return EMPTY;
  }
  const s = String(v).trim();
  return s === "" ? EMPTY : s;
}

function BillingRemainingLabel({ days }: { days: number }) {
  if (days >= 0) {
    return <span className={styles.billingRemaining}>剩余{days}天</span>;
  }
  const overdueDays = Math.abs(days);
  return (
    <span className={styles.billingOverdueWrap}>
      <span className={styles.billingOverdueText}>已到期</span>
      <Tooltip title={`-${overdueDays}天`}>
        <QuestionCircleOutlined className={styles.billingOverdueIcon} aria-label={`已过期 ${overdueDays} 天`} />
      </Tooltip>
    </span>
  );
}

export function SubscriptionUsers() {
  const { user } = useAuth();
  const canEditSubscriptionStatus = user != null && isAdminUser(user);
  const [loading, setLoading] = useState(false);
  const [statusEditRow, setStatusEditRow] = useState<AdminUserSubscriptionRow | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusEditForm] = Form.useForm<{ status: string }>();
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
  const [responseCodeInput, setResponseCodeInput] = useState("");
  const [responseCode, setResponseCode] = useState("");
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [batchSaving, setBatchSaving] = useState(false);
  const searchTimer = useRef<number | null>(null);
  const channelSearchTimer = useRef<number | null>(null);
  const responseCodeSearchTimer = useRef<number | null>(null);

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
      responseCode,
    }),
    [userId, dateRange, orderStatus, timeType, productId, channel, payCount, orderBy, page, responseCode],
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

  const onResponseCodeChange = (v: string) => {
    setResponseCodeInput(v);
    if (responseCodeSearchTimer.current) {
      window.clearTimeout(responseCodeSearchTimer.current);
    }
    responseCodeSearchTimer.current = window.setTimeout(() => {
      setResponseCode(v.trim());
      setPage(1);
    }, 400);
  };

  const runSearch = useCallback(() => {
    const uid = userIdInput.trim();
    const ch = channelInput.trim();
    const rc = responseCodeInput.trim();
    setUserId(uid);
    setChannel(ch);
    setResponseCode(rc);
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
      responseCode: rc,
    });
  }, [
    userIdInput,
    channelInput,
    responseCodeInput,
    dateRange,
    orderStatus,
    timeType,
    productId,
    payCount,
    orderBy,
    fetchList,
  ]);

  const openStatusEditModal = useCallback(
    (record: AdminUserSubscriptionRow) => {
      const current = String(record.status ?? "");
      const initial = SUBSCRIPTION_STATUS_EDIT_OPTIONS.some((o) => o.value === current) ? current : "";
      setStatusEditRow(record);
      statusEditForm.setFieldsValue({ status: initial || undefined });
    },
    [statusEditForm],
  );

  const closeStatusEditModal = useCallback(() => {
    if (statusSaving) {
      return;
    }
    setStatusEditRow(null);
    statusEditForm.resetFields();
  }, [statusEditForm, statusSaving]);

  const submitStatusEdit = useCallback(async () => {
    if (!statusEditRow) {
      return;
    }
    const id = Number(statusEditRow.id);
    if (!Number.isFinite(id) || id <= 0) {
      message.warning("缺少记录 id，无法保存");
      return;
    }
    let statusStr: string;
    try {
      const v = await statusEditForm.validateFields();
      statusStr = v.status;
    } catch {
      return;
    }
    const status = Number(statusStr);
    if (!Number.isFinite(status)) {
      return;
    }
    setStatusSaving(true);
    try {
      const res: ApiResult<unknown> = await apiPostJson("admin/subscription/save", {
        id,
        status,
      });
      if (!isApiResultOk(res)) {
        message.error(getApiErrorMessage(res, "保存失败"));
        return;
      }
      message.success(typeof res.m === "string" && res.m.trim() ? res.m.trim() : "已更新状态");
      setStatusEditRow(null);
      statusEditForm.resetFields();
      void fetchList(listQuery);
    } catch {
      message.error("网络异常");
    } finally {
      setStatusSaving(false);
    }
  }, [statusEditRow, statusEditForm, fetchList, listQuery]);

  const resolveSelectedIds = useCallback((): number[] => {
    const idSet = new Set<number>();
    for (const key of selectedRowKeys) {
      const row = apiRows.find((r) => rowStableKey(r) === key);
      const id = Number(row?.id);
      if (Number.isFinite(id) && id > 0) {
        idSet.add(id);
      }
    }
    return [...idSet];
  }, [selectedRowKeys, apiRows]);

  const confirmBatchExecute = useCallback(() => {
    const ids = resolveSelectedIds();
    if (ids.length === 0) {
      message.warning(selectedRowKeys.length > 0 ? "所选记录缺少有效 id" : "请先勾选要执行的记录");
      return;
    }
    Modal.confirm({
      title: "确认批量立即执行？",
      content: (
        <div>
          <p>将对以下 {ids.length} 条记录提交立即执行（status=11），接口：admin/subscription/save</p>
          <p>
            记录 ID：<strong>{ids.join(", ")}</strong>
          </p>
        </div>
      ),
      okText: "确认执行",
      cancelText: "取消",
      onOk: async () => {
        setBatchSaving(true);
        try {
          const res: ApiResult<unknown> = await apiPostJson("admin/subscription/save", {
            ids: ids.join(","),
            status: 11,
          });
          if (!isApiResultOk(res)) {
            message.error(getApiErrorMessage(res, "批量执行失败"));
            return Promise.reject(new Error("batch-fail"));
          }
          message.success(typeof res.m === "string" && res.m.trim() ? res.m.trim() : "已提交批量立即执行");
          setSelectedRowKeys([]);
          void fetchList(listQuery);
        } catch {
          message.error("网络异常");
          return Promise.reject(new Error("network"));
        } finally {
          setBatchSaving(false);
        }
      },
    });
  }, [resolveSelectedIds, selectedRowKeys.length, fetchList, listQuery]);

  useEffect(
    () => () => {
      if (searchTimer.current) {
        window.clearTimeout(searchTimer.current);
      }
      if (channelSearchTimer.current) {
        window.clearTimeout(channelSearchTimer.current);
      }
      if (responseCodeSearchTimer.current) {
        window.clearTimeout(responseCodeSearchTimer.current);
      }
    },
    [],
  );

  useEffect(() => {
    setSelectedRowKeys([]);
  }, [page, userId, dateRange, orderStatus, timeType, productId, channel, payCount, responseCode, orderBy]);

  const renewalStatRows = useMemo(
    () => buildSubscriptionRenewalStatRows(listCount, subscriptionStat),
    [listCount, subscriptionStat],
  );

  const pageStatusCounts = useMemo(() => countSubscriptionPageStatus(apiRows), [apiRows]);

  const columns: ColumnsType<AdminUserSubscriptionRow> = useMemo(
    () => [
      {
        title: <span className={styles.colTitle}>ID</span>,
        key: "id",
        dataIndex: "id",
        width: 88,
        fixed: "left",
        className: styles.notionCell,
        render: (_: unknown, record) => {
          const v = cellStr(record.id);
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
          const opTimeRaw = pickOpTime(record);
          const hasOpTime = opTimeRaw != null;
          const opTimeLabel = hasOpTime ? formatCnDateTime(opTimeRaw) : "—";
          return (
            <div className={styles.billingAtCell}>
              <div className={styles.billingAtTopRow}>
                <span className={styles.plainText}>{time}</span>
                {remaining != null ? <BillingRemainingLabel days={remaining} /> : null}
              </div>
              <span className={hasOpTime ? styles.opTime : styles.opTimeEmpty}>
                手动操作：{opTimeLabel}
              </span>
            </div>
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
        width: 168,
        className: `${styles.notionCell} ${styles.statusCell}`,
        render: (_: unknown, record) => (
          <div className={styles.statusCellInner}>
            <NotionTag wrap tone={subscriptionOrderStatusTone(record)} />
            {canEditSubscriptionStatus ? (
              <Tooltip title="修改状态">
                <Button
                  type="text"
                  size="small"
                  className={styles.statusEditBtn}
                  icon={<EditOutlined />}
                  aria-label="修改状态"
                  onClick={() => openStatusEditModal(record)}
                />
              </Tooltip>
            ) : null}
          </div>
        ),
      },
      {
        title: (
          <span className={styles.colTitle}>
            <PayCircleOutlined className={styles.colIcon} />
            空中授权状态码
          </span>
        ),
        key: "response_code",
        width: 100,
        className: styles.notionCell,
        render: (_: unknown, record) => {
          const v = cellStr(record.response_code);
          return (
            <Typography.Text
              className={styles.plainText}
              ellipsis={{ tooltip: v !== EMPTY ? v : false }}
              copyable={v !== EMPTY ? { text: v } : false}
            >
              {v}
            </Typography.Text>
          );
        },
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
            <PayCircleOutlined className={styles.colIcon} />
            付费方式
          </span>
        ),
        key: "payment_method",
        width: 160,
        className: styles.notionCell,
        render: (_: unknown, record) => {
          const row = record as Record<string, unknown>;
          if (!resolveSubscriptionPaymentMethodDisplay(row)) {
            return <span className={styles.plainText}>{EMPTY}</span>;
          }
          return <OrderPaymentMethodDisplay record={row} />;
        },
      },
    ],
    [orderBy, canEditSubscriptionStatus, openStatusEditModal],
  );

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <Typography.Title level={4} className={styles.pageTitle}>
          订阅用户
        </Typography.Title>
        <div className={styles.pageHeadRight}>
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
          <div className={orderStyles.filterItem}>
            <span className={orderStyles.filterLabel}>云中授权状态</span>
            <Input
              allowClear
              className={styles.responseCodeField}
              placeholder="状态码"
              value={responseCodeInput}
              onChange={(e) => onResponseCodeChange(e.target.value)}
              maxLength={64}
            />
          </div>
          <Button type="primary" onClick={runSearch}>
            搜索
          </Button>
          <Tooltip title="日期与「时间字段」搭配：开始订阅时间、更新时间或结束时间（billing_at）">
            <QuestionCircleOutlined className={styles.filterHelp} />
          </Tooltip>
          {canEditSubscriptionStatus ? (
            <div className={styles.filterBarActions}>
              <Button
                icon={<ThunderboltOutlined />}
                loading={batchSaving}
                disabled={selectedRowKeys.length === 0}
                onClick={confirmBatchExecute}
              >
                批量立即执行
              </Button>
            </div>
          ) : null}
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
          rowSelection={
            canEditSubscriptionStatus
              ? {
                  selectedRowKeys,
                  onChange: (keys) => setSelectedRowKeys(keys.map(String)),
                  preserveSelectedRowKeys: false,
                }
              : undefined
          }
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

      <Modal
        title="修改订阅状态"
        open={statusEditRow != null}
        onCancel={closeStatusEditModal}
        onOk={() => void submitStatusEdit()}
        okText="保存"
        cancelText="取消"
        confirmLoading={statusSaving}
        destroyOnHidden
        maskClosable={!statusSaving}
        width={440}
      >
        {statusEditRow ? (
          <>
            <div className={styles.statusModalMeta}>
              <span>记录 ID：{cellStr(statusEditRow.id)}</span>
              <span>用户 ID：{cellStr(statusEditRow.user_id)}</span>
              <span>
                当前状态：
                <NotionTag wrap tone={subscriptionOrderStatusTone(statusEditRow)} />
              </span>
            </div>
            <Form form={statusEditForm} layout="vertical" className={styles.statusModalForm}>
              <Form.Item
                name="status"
                label="新状态"
                rules={[{ required: true, message: "请选择状态" }]}
              >
                <Select placeholder="请选择" options={SUBSCRIPTION_STATUS_EDIT_OPTIONS} />
              </Form.Item>
            </Form>
          </>
        ) : null}
      </Modal>
    </div>
  );
}
