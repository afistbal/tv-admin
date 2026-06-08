import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircleOutlined, ClockCircleOutlined } from "@ant-design/icons";
import { Button, DatePicker, Input, Pagination, Select, Table, Typography, message } from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import type { ColumnsType } from "antd/es/table";
import { apiGet, apiPostJson } from "@/api/client";
import type { ApiGetQueryValue } from "@/api/client";
import type { ApiResult } from "@/api/types";
import type {
  AdminFeedbackListPayload,
  AdminFeedbackRow,
  AdminFeedbackStatus,
} from "@/types/adminFeedback";
import { ADMIN_FEEDBACK_STATUS_OPTIONS } from "@/types/adminFeedback";
import { useIsMobileH5 } from "@/hooks/useIsMobileH5";
import { formatDateTimeZh } from "@/lib/formatDateTime";
import { mainContentTableSticky } from "@/lib/tableSticky";
import listStyles from "./FeedbackList.module.css";

const FEEDBACK_STATUS_FILTER_OPTIONS = [
  { value: "", label: "全部状态" },
  ...ADMIN_FEEDBACK_STATUS_OPTIONS.map((o) => ({ value: String(o.value), label: o.label })),
];

const TABLE_SCROLL_X = 48 + 96 + 96 + 220 + 320 + 120 + 180 + 120;

function defaultTodayRange(): [Dayjs, Dayjs] {
  const d = dayjs();
  return [d.startOf("day"), d.startOf("day")];
}

function rangeToDaterangeStrings(range: [Dayjs, Dayjs]): [string, string] {
  const [from, to] = range;
  return [from.startOf("day").format("YYYY-MM-DD HH:mm:ss"), to.endOf("day").format("YYYY-MM-DD HH:mm:ss")];
}

function feedbackStatusOf(row: AdminFeedbackRow): AdminFeedbackStatus {
  return Number(row.status) === 1 ? 1 : 0;
}

function StatusPill({ status }: { status: AdminFeedbackStatus }) {
  const processed = status === 1;
  return (
    <span className={listStyles.statusPill}>
      {processed ? (
        <CheckCircleOutlined className={listStyles.statusPillIcon} />
      ) : (
        <ClockCircleOutlined className={listStyles.statusPillIcon} />
      )}
      {processed ? "已处理" : "未处理"}
    </span>
  );
}

export function FeedbackList() {
  const isCompact = useIsMobileH5();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AdminFeedbackRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(24);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [userIdInput, setUserIdInput] = useState("");
  const [userId, setUserId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(() => defaultTodayRange());
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [statusSaving, setStatusSaving] = useState(false);
  const [rowStatusSavingId, setRowStatusSavingId] = useState<number | null>(null);

  const fetchList = useCallback(
    async (
      p: number,
      kw: string,
      uid: string,
      status: string,
      range: [Dayjs, Dayjs] | null,
    ) => {
      setLoading(true);
      try {
        const kwTrim = kw.trim();
        const uidTrim = uid.trim();
        const q: Record<string, ApiGetQueryValue> = {
          page: p,
          keyword: kwTrim || undefined,
          user_id: uidTrim || undefined,
          status: status !== "" ? status : undefined,
        };
        if (range != null) {
          q.daterange = rangeToDaterangeStrings(range);
        }
        const res: ApiResult<AdminFeedbackListPayload> = await apiGet<AdminFeedbackListPayload>("admin/feedback", q);
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
    void fetchList(page, keyword, userId, statusFilter, dateRange);
  }, [page, keyword, userId, statusFilter, dateRange, fetchList]);

  useEffect(() => {
    setSelectedRowKeys([]);
  }, [page, keyword, userId, statusFilter, dateRange]);

  const updateStatus = useCallback(
    async (ids: number[], status: AdminFeedbackStatus) => {
      if (ids.length === 0) {
        message.warning("请先勾选要操作的记录");
        return false;
      }
      try {
        const res: ApiResult<unknown> = await apiPostJson("admin/feedback/status", { ids, status });
        if (res.c !== 0) {
          message.error(res.m || "操作失败");
          return false;
        }
        message.success(res.m?.trim() || "已更新状态");
        setSelectedRowKeys([]);
        await fetchList(page, keyword, userId, statusFilter, dateRange);
        return true;
      } catch {
        message.error("网络异常");
        return false;
      }
    },
    [fetchList, page, keyword, userId, statusFilter, dateRange],
  );

  const handleBatchStatus = useCallback(
    async (status: AdminFeedbackStatus) => {
      setStatusSaving(true);
      try {
        await updateStatus(selectedRowKeys, status);
      } finally {
        setStatusSaving(false);
      }
    },
    [selectedRowKeys, updateStatus],
  );

  const handleRowStatusChange = useCallback(
    async (row: AdminFeedbackRow, status: AdminFeedbackStatus) => {
      const id = Number(row.id);
      if (!Number.isFinite(id) || id <= 0) {
        message.warning("缺少有效 id");
        return;
      }
      if (feedbackStatusOf(row) === status) {
        return;
      }
      setRowStatusSavingId(id);
      try {
        await updateStatus([id], status);
      } finally {
        setRowStatusSavingId(null);
      }
    },
    [updateStatus],
  );

  const runSearch = useCallback(() => {
    const kw = keywordInput.trim();
    const uid = userIdInput.trim();
    setKeyword(kw);
    setUserId(uid);
    setPage(1);
    if (page === 1) {
      void fetchList(1, kw, uid, statusFilter, dateRange);
    }
  }, [keywordInput, userIdInput, page, statusFilter, dateRange, fetchList]);

  const selectedCount = selectedRowKeys.length;

  const columns: ColumnsType<AdminFeedbackRow> = useMemo(
    () => [
      {
        title: "反馈 ID",
        dataIndex: "id",
        width: isCompact ? 80 : 96,
        fixed: isCompact ? "left" : undefined,
      },
      {
        title: "用户 ID",
        dataIndex: "user_id",
        width: isCompact ? 80 : 96,
        render: (v: unknown) => {
          const s = v != null && String(v) !== "" ? String(v) : "";
          if (!s) {
            return "—";
          }
          return <Typography.Text copyable={{ text: s }}>{s}</Typography.Text>;
        },
      },
      {
        title: "用户邮箱",
        dataIndex: "email",
        width: isCompact ? 160 : 220,
        ellipsis: { showTitle: true },
        render: (v: unknown) => {
          const s = v != null ? String(v).trim() : "";
          if (!s) {
            return "—";
          }
          return <Typography.Text copyable={{ text: s }}>{s}</Typography.Text>;
        },
      },
      {
        title: "反馈描述",
        dataIndex: "content",
        width: isCompact ? 200 : 320,
        render: (v: unknown) => {
          const s = v != null ? String(v).trim() : "";
          if (!s) {
            return "—";
          }
          return (
            <div className={listStyles.contentCell} title={s}>
              <span className={listStyles.twoLinesText}>{s}</span>
            </div>
          );
        },
      },
      {
        title: "处理状态",
        dataIndex: "status",
        width: 108,
        render: (_: unknown, record) => <StatusPill status={feedbackStatusOf(record)} />,
      },
      {
        title: "提交时间",
        dataIndex: "created_at",
        width: isCompact ? 150 : 180,
        render: (v: unknown) => formatDateTimeZh(v != null ? String(v) : null),
      },
      {
        title: "操作",
        key: "action",
        width: 108,
        fixed: "right",
        render: (_: unknown, record) => {
          const id = Number(record.id);
          const current = feedbackStatusOf(record);
          return (
            <Select<AdminFeedbackStatus>
              className={listStyles.statusSelect}
              size="small"
              value={current}
              options={ADMIN_FEEDBACK_STATUS_OPTIONS}
              loading={rowStatusSavingId === id}
              disabled={rowStatusSavingId === id || statusSaving}
              onChange={(v) => void handleRowStatusChange(record, v)}
              popupMatchSelectWidth={false}
            />
          );
        },
      },
    ],
    [handleRowStatusChange, isCompact, rowStatusSavingId, statusSaving],
  );

  return (
    <div className={listStyles.page}>
      <Typography.Title level={4} className={listStyles.pageTitle}>
        需求处理
      </Typography.Title>

      <div className={listStyles.filterBar}>
        <div className={listStyles.filterItem}>
          <span className={listStyles.filterLabel}>日期：</span>
          <DatePicker.RangePicker
            className={listStyles.dateRange}
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
        <div className={listStyles.filterItem}>
          <span className={listStyles.filterLabel}>关键词：</span>
          <Input
            allowClear
            className={listStyles.keywordField}
            placeholder="输入反馈内容/邮箱进行搜索..."
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onPressEnter={runSearch}
            maxLength={64}
          />
        </div>
        <div className={listStyles.filterItem}>
          <span className={listStyles.filterLabel}>用户 id：</span>
          <Input
            allowClear
            className={listStyles.userIdField}
            placeholder="用户 id"
            value={userIdInput}
            onChange={(e) => setUserIdInput(e.target.value)}
            onPressEnter={runSearch}
            maxLength={64}
          />
        </div>
        <div className={listStyles.filterItem}>
          <span className={listStyles.filterLabel}>处理状态：</span>
          <Select
            className={listStyles.statusField}
            value={statusFilter}
            options={FEEDBACK_STATUS_FILTER_OPTIONS}
            onChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
          />
        </div>
        <Button type="primary" onClick={runSearch}>
          搜索
        </Button>
        <span className={listStyles.totalHint}>共 {total} 条</span>
        <div className={listStyles.filterBarActions}>
          <Button
            icon={<ClockCircleOutlined />}
            loading={statusSaving}
            disabled={selectedCount === 0}
            onClick={() => void handleBatchStatus(0)}
          >
            批量改为未处理 ({selectedCount})
          </Button>
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            loading={statusSaving}
            disabled={selectedCount === 0}
            onClick={() => void handleBatchStatus(1)}
          >
            批量改为已处理 ({selectedCount})
          </Button>
        </div>
      </div>

      <div className={listStyles.tableScroll}>
        <Table<AdminFeedbackRow>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={rows}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys.map(Number)),
            preserveSelectedRowKeys: false,
            columnWidth: isCompact ? 40 : 48,
          }}
          pagination={false}
          sticky={mainContentTableSticky}
          scroll={{ x: TABLE_SCROLL_X }}
          size={isCompact ? "small" : "middle"}
          tableLayout="fixed"
        />
      </div>

      <div className={listStyles.paginationWrap}>
        <Pagination
          current={page}
          pageSize={perPage}
          total={total}
          simple={isCompact}
          showSizeChanger={false}
          showTotal={isCompact ? undefined : (t) => `共 ${t} 条`}
          onChange={(p) => setPage(p)}
        />
      </div>
    </div>
  );
}
