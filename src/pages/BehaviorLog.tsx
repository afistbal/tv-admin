import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, DatePicker, Input, Space, Table, Typography, message } from "antd";
import type { Dayjs } from "dayjs";
import type { ColumnsType } from "antd/es/table";
import { apiGet, type ApiGetQueryValue } from "@/api/client";
import type { ApiResult } from "@/api/types";
import type { AdminBehaviorLogListPayload, AdminBehaviorLogRow } from "@/types/adminBehaviorLog";
import styles from "./UserList.module.css";

const { RangePicker } = DatePicker;

const FIELD_LABELS: Record<string, string> = {
  id: "编号",
  user_id: "用户 ID",
  target: "目标 ID",
  remark: "备注",
  keyword: "关键词",
  action: "行为",
  event: "事件",
  type: "类型",
  name: "名称",
  title: "标题",
  content: "内容",
  description: "描述",
  url: "页面地址",
  path: "路径",
  ip: "IP",
  source: "来源",
  created_at: "创建时间",
  updated_at: "更新时间",
  time: "时间",
};

const PREFERRED_FIELDS = [
  "source",
  "user_id",
  "target",
  "remark",
  "action",
  "ip",
  "created_at",
  "id",
  "event",
  "type",
  "name",
  "title",
  "content",
  "description",
  "url",
  "path",
  "updated_at",
  "time",
];

const BASE_FIELDS = ["source", "user_id", "target", "remark", "action", "ip", "created_at"];

function rangeToDaterangeStrings(range: [Dayjs, Dayjs]): [string, string] {
  return [
    range[0].startOf("day").format("YYYY-MM-DD HH:mm:ss"),
    range[1].endOf("day").format("YYYY-MM-DD HH:mm:ss"),
  ];
}

function displayValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function payloadRows(payload: AdminBehaviorLogListPayload | AdminBehaviorLogRow[]): AdminBehaviorLogRow[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.rows)) return payload.rows;
  if (Array.isArray(payload.list)) return payload.list;
  return [];
}

export function BehaviorLog() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AdminBehaviorLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [keywordInput, setKeywordInput] = useState("");
  const [userIdInput, setUserIdInput] = useState("");
  const [dateRangeInput, setDateRangeInput] = useState<[Dayjs, Dayjs] | null>(null);
  const [filters, setFilters] = useState<{ keyword: string; userId: string; dateRange: [Dayjs, Dayjs] | null }>({
    keyword: "",
    userId: "",
    dateRange: null,
  });

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const query: Record<string, ApiGetQueryValue> = {
        page,
        keyword: filters.keyword || undefined,
        user_id: filters.userId || undefined,
      };
      if (filters.dateRange) query.daterange = rangeToDaterangeStrings(filters.dateRange);

      const res: ApiResult<AdminBehaviorLogListPayload | AdminBehaviorLogRow[]> = await apiGet(
        "admin/stat/list",
        query,
      );
      if (res.c !== 0) {
        message.error(res.m || "加载失败");
        setRows([]);
        setTotal(0);
        return;
      }

      const nextRows = payloadRows(res.d);
      const payload = Array.isArray(res.d) ? null : res.d;
      setRows(nextRows);
      setTotal(Number(payload?.count ?? payload?.total) || nextRows.length);
      setPageSize(Number(payload?.per_page) || 24);
      setPage(Number(payload?.current_page) || page);
    } catch {
      message.error("网络异常");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const columns = useMemo<ColumnsType<AdminBehaviorLogRow>>(() => {
    const fields = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
    const ordered = [
      ...PREFERRED_FIELDS.filter((field) => BASE_FIELDS.includes(field) || fields.includes(field)),
      ...fields.filter((field) => !PREFERRED_FIELDS.includes(field)),
    ];
    return ordered.map((field) => ({
      title: FIELD_LABELS[field] ?? field,
      dataIndex: field,
      key: field,
      ellipsis: true,
      width:
        field === "remark" || field === "content" || field === "description"
          ? 240
          : field === "created_at"
            ? 180
            : 140,
      render: (value: unknown) => (
        <Typography.Text title={displayValue(value)}>{displayValue(value)}</Typography.Text>
      ),
    }));
  }, [rows]);

  const applySearch = () => {
    const next = {
      keyword: keywordInput.trim(),
      userId: userIdInput.trim(),
      dateRange: dateRangeInput,
    };
    setPage(1);
    setFilters(next);
  };

  const resetSearch = () => {
    setKeywordInput("");
    setUserIdInput("");
    setDateRangeInput(null);
    setPage(1);
    setFilters({ keyword: "", userId: "", dateRange: null });
  };

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        行为日志
      </Typography.Title>

      <div className={styles.toolbar}>
        <Space wrap size={12} className={styles.toolbarLeft}>
          <Input
            allowClear
            placeholder="关键词"
            value={keywordInput}
            onChange={(event) => setKeywordInput(event.target.value)}
            onPressEnter={applySearch}
            style={{ width: 220 }}
          />
          <Input
            allowClear
            placeholder="用户 ID"
            value={userIdInput}
            onChange={(event) => setUserIdInput(event.target.value)}
            onPressEnter={applySearch}
            style={{ width: 180 }}
          />
          <RangePicker
            className={styles.dateRange}
            value={dateRangeInput}
            onChange={(value) => setDateRangeInput(value as [Dayjs, Dayjs] | null)}
            format="YYYY-MM-DD"
            placeholder={["开始日期", "结束日期"]}
          />
          <Button type="primary" onClick={applySearch}>
            搜索
          </Button>
          <Button onClick={resetSearch}>重置</Button>
        </Space>
      </div>

      <Table<AdminBehaviorLogRow>
        rowKey={(record, index) => String(record.id ?? `${page}-${index}`)}
        loading={loading}
        columns={columns}
        dataSource={rows}
        scroll={{ x: "max-content" }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: false,
          showTotal: (value) => `共 ${value} 条`,
          onChange: setPage,
        }}
      />
    </div>
  );
}
