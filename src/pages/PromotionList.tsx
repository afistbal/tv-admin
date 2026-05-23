import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button, Input, Select, Space, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { apiGet } from "@/api/client";
import type { ApiResult } from "@/api/types";
import type { AdminSourceFormRow, AdminSourceRow } from "@/types/adminSourceList";
import { rowsFromSourceListPayload } from "@/lib/adminSourceList";
import { mainContentTableSticky } from "@/lib/tableSticky";
import stylesToolbar from "./UserList.module.css";
import styles from "./PromotionList.module.css";
import { PromotionSourceEditModal } from "./PromotionSourceEditModal";

const TYPE_FILTER_OPTIONS = [
  { value: "", label: "全部" },
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
];

function typeTag(type: string): ReactNode {
  const t = type.trim().toLowerCase();
  if (t === "facebook") {
    return <Tag color="geekblue">Facebook</Tag>;
  }
  if (t === "tiktok") {
    return <Tag color="magenta">TikTok</Tag>;
  }
  return type || "—";
}

function statusTag(status: number): ReactNode {
  if (status === 1) {
    return <Tag color="success">启用</Tag>;
  }
  if (status === 0) {
    return <Tag>停用</Tag>;
  }
  return String(status);
}

export function PromotionList() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AdminSourceRow[]>([]);
  const [typeInput, setTypeInput] = useState("");
  const [sourceInput, setSourceInput] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [formRow, setFormRow] = useState<AdminSourceFormRow | null>(null);
  const searchTimer = useRef<number | null>(null);

  const fetchList = useCallback(async (type: string, source: string) => {
    setLoading(true);
    try {
      const query: Record<string, string> = {};
      if (type.trim()) {
        query.type = type.trim();
      }
      if (source.trim()) {
        query.source = source.trim();
      }
      const res: ApiResult<unknown> = await apiGet<unknown>("admin/source/list", query);
      if (res.c !== 0) {
        message.error(res.m || "加载失败");
        setRows([]);
        return;
      }
      setRows(rowsFromSourceListPayload(res.d));
    } catch {
      message.error("网络异常");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchList(typeFilter, sourceFilter);
  }, [typeFilter, sourceFilter, fetchList]);

  useEffect(
    () => () => {
      if (searchTimer.current) {
        window.clearTimeout(searchTimer.current);
      }
    },
    [],
  );

  const scheduleSourceSearch = useCallback(
    (source: string) => {
      if (searchTimer.current) {
        window.clearTimeout(searchTimer.current);
      }
      searchTimer.current = window.setTimeout(() => {
        setSourceFilter(source.trim());
      }, 400);
    },
    [],
  );

  const onTypeChange = (v: string) => {
    const next = v ?? "";
    setTypeInput(next);
    if (searchTimer.current) {
      window.clearTimeout(searchTimer.current);
    }
    setTypeFilter(next);
    setSourceFilter(sourceInput.trim());
  };

  const onSourceChange = (v: string) => {
    setSourceInput(v);
    scheduleSourceSearch(v);
  };

  const handleReset = () => {
    if (searchTimer.current) {
      window.clearTimeout(searchTimer.current);
    }
    setTypeInput("");
    setSourceInput("");
    setTypeFilter("");
    setSourceFilter("");
  };

  const columns: ColumnsType<AdminSourceRow> = useMemo(
    () => [
      {
        title: "ID",
        dataIndex: "id",
        key: "id",
        width: 88,
        align: "center",
      },
      {
        title: "来源",
        dataIndex: "source",
        key: "source",
        width: 180,
        ellipsis: true,
        render: (v: string) => v || "—",
      },
      {
        title: "类型",
        dataIndex: "type",
        key: "type",
        width: 128,
        align: "center",
        render: (v: string) => typeTag(v),
      },
      {
        title: "状态",
        dataIndex: "status",
        key: "status",
        width: 108,
        align: "center",
        render: (status: number) => statusTag(status),
      },
      {
        title: "像素id",
        dataIndex: "source_id",
        key: "source_id",
        ellipsis: { showTitle: true },
        render: (v: string) => v || "—",
      },
      {
        title: "操作",
        key: "actions",
        width: 96,
        align: "center",
        className: styles.opCol,
        render: (_: unknown, row) => (
          <Button type="link" size="small" onClick={() => { setFormMode("edit"); setFormRow(row); }}>
            编辑
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        推广列表
      </Typography.Title>

      <div className={stylesToolbar.toolbar}>
        <Space wrap className={stylesToolbar.toolbarLeft} align="center">
          <Typography.Text type="secondary">类型</Typography.Text>
          <Select
            value={typeInput}
            style={{ width: 128 }}
            placeholder="全部"
            allowClear
            options={TYPE_FILTER_OPTIONS}
            onChange={onTypeChange}
          />
          <Typography.Text type="secondary">来源</Typography.Text>
          <Input
            allowClear
            placeholder="来源"
            value={sourceInput}
            onChange={(e) => onSourceChange(e.target.value)}
            style={{ width: 160 }}
          />
          <Button onClick={handleReset}>重置</Button>
          <Typography.Text type="secondary">共 {rows.length} 条</Typography.Text>
        </Space>
        <Space wrap className={stylesToolbar.toolbarRight}>
          <Button
            type="primary"
            onClick={() => {
              setFormMode("create");
              setFormRow({ status: 1, type: "facebook" });
            }}
          >
            新增推广
          </Button>
        </Space>
      </div>

      <Table<AdminSourceRow>
        className={styles.table}
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={false}
        sticky={mainContentTableSticky}
        size="middle"
        tableLayout="fixed"
        locale={{ emptyText: loading ? "加载中…" : "暂无数据" }}
      />

      {formMode != null && formRow != null ? (
        <PromotionSourceEditModal
          key={formMode === "create" ? "new" : formRow.id}
          mode={formMode}
          row={formRow}
          onClose={() => {
            setFormMode(null);
            setFormRow(null);
          }}
          onSaved={() => void fetchList(typeFilter, sourceFilter)}
        />
      ) : null}
    </div>
  );
}
