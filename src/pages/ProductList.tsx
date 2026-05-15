import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, Empty, Space, Spin, Switch, Table, Tabs, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { apiGet } from "@/api/client";
import type { ApiResult } from "@/api/types";
import type { AdminProductListPayload, AdminProductRow } from "@/types/adminProduct";
import { formatDateTimeZh } from "@/lib/formatDateTime";
import { ProductEditModal } from "./ProductEditModal";

type ProductTabKey = "package" | "coin";

const TAB_ITEMS: { key: ProductTabKey; label: string; type: 1 | 2 }[] = [
  { key: "package", label: "套餐列表", type: 1 },
  { key: "coin", label: "金币列表", type: 2 },
];

const EMPTY = "—";

function productStatusTag(status: unknown): ReactNode {
  const s = Number(status);
  if (s === 1) {
    return <Tag color="success">显示</Tag>;
  }
  if (s === 0) {
    return <Tag>隐藏</Tag>;
  }
  return String(status ?? EMPTY);
}

function rowsFromPayload(d: unknown): AdminProductRow[] {
  if (d != null && typeof d === "object" && Array.isArray((d as AdminProductListPayload).data)) {
    return (d as AdminProductListPayload).data;
  }
  return [];
}

export function ProductList() {
  const [activeTab, setActiveTab] = useState<ProductTabKey>("package");
  /** true = status=1（显示中）；false = status=0（已隐藏） */
  const [showVisible, setShowVisible] = useState(true);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AdminProductRow[]>([]);
  const [editingRow, setEditingRow] = useState<AdminProductRow | null>(null);

  const activeType = TAB_ITEMS.find((t) => t.key === activeTab)?.type ?? 1;
  const listStatus: 0 | 1 = showVisible ? 1 : 0;

  const load = useCallback(async (type: 1 | 2, status: 0 | 1) => {
    setLoading(true);
    try {
      const res: ApiResult<AdminProductListPayload> = await apiGet<AdminProductListPayload>("admin/product/list", {
        type,
        status,
      });
      if (res.c !== 0) {
        message.error(res.m || "加载失败");
        setRows([]);
        return;
      }
      setRows(rowsFromPayload(res.d));
    } catch {
      message.error("网络异常");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useCallback(() => {
    void load(activeType, listStatus);
  }, [activeType, listStatus, load]);

  useEffect(() => {
    void load(activeType, listStatus);
  }, [activeType, listStatus, load]);

  const openEdit = useCallback((row: AdminProductRow) => {
    setEditingRow(row);
  }, []);

  const packageColumns: ColumnsType<AdminProductRow> = useMemo(
    () => [
      { title: "ID", dataIndex: "id", key: "id", width: 88 },
      { title: "名称", dataIndex: "name", key: "name", width: 140, ellipsis: true },
      { title: "价格", dataIndex: "price", key: "price", width: 96 },
      { title: "续费价格", dataIndex: "renewal_price", key: "renewal_price", width: 108 },
      {
        title: "状态",
        dataIndex: "status",
        key: "status",
        width: 88,
        align: "center",
        render: (v) => productStatusTag(v),
      },
      {
        title: "创建时间",
        dataIndex: "created_at",
        key: "created_at",
        width: 172,
        render: (v) => (v ? formatDateTimeZh(v) : EMPTY),
      },
      {
        title: "更新时间",
        dataIndex: "updated_at",
        key: "updated_at",
        width: 172,
        render: (v) => (v ? formatDateTimeZh(v) : EMPTY),
      },
      {
        title: "操作",
        key: "action",
        width: 88,
        fixed: "right",
        render: (_: unknown, record) => (
          <Button type="link" size="small" onClick={() => openEdit(record)}>
            编辑
          </Button>
        ),
      },
    ],
    [openEdit],
  );

  const coinColumns: ColumnsType<AdminProductRow> = useMemo(
    () => [
      { title: "ID", dataIndex: "id", key: "id", width: 88 },
      { title: "名称", dataIndex: "name", key: "name", width: 140, ellipsis: true },
      { title: "价格", dataIndex: "price", key: "price", width: 96 },
      { title: "金币", dataIndex: "coin", key: "coin", width: 88, align: "right" },
      { title: "赠送比例", dataIndex: "bouns", key: "bouns", width: 100 },
      {
        title: "状态",
        dataIndex: "status",
        key: "status",
        width: 88,
        align: "center",
        render: (v) => productStatusTag(v),
      },
      {
        title: "创建时间",
        dataIndex: "created_at",
        key: "created_at",
        width: 172,
        render: (v) => (v ? formatDateTimeZh(v) : EMPTY),
      },
      {
        title: "更新时间",
        dataIndex: "updated_at",
        key: "updated_at",
        width: 172,
        render: (v) => (v ? formatDateTimeZh(v) : EMPTY),
      },
      {
        title: "操作",
        key: "action",
        width: 88,
        fixed: "right",
        render: (_: unknown, record) => (
          <Button type="link" size="small" onClick={() => openEdit(record)}>
            编辑
          </Button>
        ),
      },
    ],
    [openEdit],
  );

  const columns = activeTab === "package" ? packageColumns : coinColumns;

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        产品管理
      </Typography.Title>

      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as ProductTabKey)}
        items={TAB_ITEMS.map(({ key, label }) => ({ key, label }))}
      />

      <Space style={{ margin: "16px 0" }} align="center">
        <Typography.Text>显示范围</Typography.Text>
        <Switch
          checked={showVisible}
          checkedChildren="显示"
          unCheckedChildren="隐藏"
          onChange={setShowVisible}
        />
      </Space>

      <Spin spinning={loading}>
        {!loading && rows.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
        ) : (
          <Table<AdminProductRow>
            rowKey="id"
            columns={columns}
            dataSource={rows}
            pagination={false}
            scroll={{ x: "max-content" }}
            size="middle"
          />
        )}
      </Spin>

      {editingRow ? (
        <ProductEditModal
          row={editingRow}
          onClose={() => setEditingRow(null)}
          onSaved={reload}
        />
      ) : null}
    </div>
  );
}
