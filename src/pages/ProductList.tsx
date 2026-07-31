import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Alert, Button, Empty, Space, Spin, Switch, Table, Tabs, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { apiGet } from "@/api/client";
import type { ApiResult } from "@/api/types";
import type { AdminProductListPayload, AdminProductRow } from "@/types/adminProduct";
import type {
  GoogleProductListPayload,
  GoogleProductPlatform,
  GoogleProductRow,
} from "@/types/googleProduct";
import { formatDateTimeZh } from "@/lib/formatDateTime";
import { productDiscountSummary } from "@/lib/productExtra";
import { GoogleProductEditModal } from "./GoogleProductEditModal";
import { ProductEditModal } from "./ProductEditModal";
import styles from "./ProductList.module.css";

type PlatformTabKey = "h5" | GoogleProductPlatform;
type ProductTabKey = "package" | "coin";

const PLATFORM_TAB_ITEMS: { key: PlatformTabKey; label: string }[] = [
  { key: "h5", label: "H5" },
  { key: "ios", label: "IOS" },
];

const TAB_ITEMS: { key: ProductTabKey; label: string; type: 1 | 2 }[] = [
  { key: "package", label: "套餐列表", type: 1 },
  { key: "coin", label: "金币列表", type: 2 },
];

const GOOGLE_TAB_ITEMS: { key: ProductTabKey; label: string; type: 1 | 2 }[] = [
  { key: "package", label: "订阅商品", type: 2 },
  { key: "coin", label: "金币列表", type: 1 },
];

const EMPTY = "—";

function productStatusTag(status: unknown, mobile = false): ReactNode {
  const s = Number(status);
  if (s === 1) {
    return <Tag color="success">{mobile ? "启用" : "显示"}</Tag>;
  }
  if (s === 0) {
    return <Tag>{mobile ? "禁用" : "隐藏"}</Tag>;
  }
  return String(status ?? EMPTY);
}

function rowsFromPayload(d: unknown): AdminProductRow[] {
  if (d != null && typeof d === "object" && Array.isArray((d as AdminProductListPayload).data)) {
    return (d as AdminProductListPayload).data;
  }
  return [];
}

function googleRowsFromPayload(d: unknown): GoogleProductRow[] {
  if (d != null && typeof d === "object" && Array.isArray((d as GoogleProductListPayload).data)) {
    return (d as GoogleProductListPayload).data;
  }
  return [];
}

function productTimeCell(row: { created_at: string | null; updated_at: string | null }): ReactNode {
  return (
    <div className={styles.timeCell}>
      <div className={styles.timeLine}>
        <span className={styles.timeLabel}>创建</span>
        <span>{row.created_at ? formatDateTimeZh(row.created_at) : EMPTY}</span>
      </div>
      <div className={styles.timeLine}>
        <span className={styles.timeLabel}>更新</span>
        <span>{row.updated_at ? formatDateTimeZh(row.updated_at) : EMPTY}</span>
      </div>
    </div>
  );
}

function productDiscountCell(extra: unknown): ReactNode {
  const lines = productDiscountSummary(extra);
  if (lines.length === 0) {
    return <span className={styles.emptyText}>{EMPTY}</span>;
  }
  return (
    <div className={styles.discountCell}>
      {lines.map((line) => (
        <span key={line}>{line}</span>
      ))}
    </div>
  );
}

export function ProductList() {
  const [activePlatform, setActivePlatform] = useState<PlatformTabKey>("h5");
  const [activeTab, setActiveTab] = useState<ProductTabKey>("package");
  /** true = status=1（显示中）；false = status=0（已隐藏） */
  const [showVisible, setShowVisible] = useState(true);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AdminProductRow[]>([]);
  const [googleRows, setGoogleRows] = useState<GoogleProductRow[]>([]);
  const [googlePage, setGooglePage] = useState(1);
  const [googlePageSize, setGooglePageSize] = useState(24);
  const [googleTotal, setGoogleTotal] = useState(0);
  const [editingRow, setEditingRow] = useState<AdminProductRow | null>(null);
  const [editingGoogleRow, setEditingGoogleRow] = useState<GoogleProductRow | null>(null);
  const requestIdRef = useRef(0);

  const activeType = (activePlatform === "h5" ? TAB_ITEMS : GOOGLE_TAB_ITEMS).find(
    (item) => item.key === activeTab,
  )?.type ?? 1;
  const listStatus: 0 | 1 = showVisible ? 1 : 0;

  const load = useCallback(async (type: 1 | 2, status: 0 | 1) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const res: ApiResult<AdminProductListPayload> = await apiGet<AdminProductListPayload>("admin/product/list", {
        type,
        status,
      });
      if (requestId !== requestIdRef.current) {
        return;
      }
      if (res.c !== 0) {
        message.error(res.m || "加载失败");
        setRows([]);
        return;
      }
      setRows(rowsFromPayload(res.d));
    } catch {
      if (requestId !== requestIdRef.current) {
        return;
      }
      message.error("网络异常");
      setRows([]);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const loadGoogleProducts = useCallback(
    async (
      platform: GoogleProductPlatform,
      type: 1 | 2,
      status: 0 | 1,
      page: number,
      perPage: number,
    ) => {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      try {
        const res: ApiResult<GoogleProductListPayload> = await apiGet<GoogleProductListPayload>(
          "admin/google-product/list",
          {
            platform,
            type,
            status,
            page,
            per_page: perPage,
          },
        );
        if (requestId !== requestIdRef.current) {
          return;
        }
        if (res.c !== 0) {
          message.error(res.m || "加载失败");
          setGoogleRows([]);
          setGoogleTotal(0);
          return;
        }
        setGoogleRows(googleRowsFromPayload(res.d));
        setGoogleTotal(Number(res.d?.count ?? 0));
      } catch {
        if (requestId !== requestIdRef.current) {
          return;
        }
        message.error("网络异常");
        setGoogleRows([]);
        setGoogleTotal(0);
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [],
  );

  const reload = useCallback(() => {
    if (activePlatform === "h5") {
      void load(activeType, listStatus);
      return;
    }
    void loadGoogleProducts(activePlatform, activeType, listStatus, googlePage, googlePageSize);
  }, [
    activePlatform,
    activeType,
    googlePage,
    googlePageSize,
    listStatus,
    load,
    loadGoogleProducts,
  ]);

  useEffect(() => {
    if (activePlatform === "h5") {
      void load(activeType, listStatus);
      return;
    }
    void loadGoogleProducts(activePlatform, activeType, listStatus, googlePage, googlePageSize);
  }, [
    activePlatform,
    activeType,
    googlePage,
    googlePageSize,
    listStatus,
    load,
    loadGoogleProducts,
  ]);

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
        title: "挽留优惠",
        dataIndex: "extra",
        key: "discounts",
        width: 152,
        render: productDiscountCell,
      },
      {
        title: "状态",
        dataIndex: "status",
        key: "status",
        width: 88,
        align: "center",
        render: (v) => productStatusTag(v),
      },
      {
        title: "时间",
        key: "time",
        width: 188,
        render: (_: unknown, row) => productTimeCell(row),
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
        title: "时间",
        key: "time",
        width: 188,
        render: (_: unknown, row) => productTimeCell(row),
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

  const googleColumns: ColumnsType<GoogleProductRow> = useMemo(() => {
    const commonColumns: ColumnsType<GoogleProductRow> = [
      { title: "ID", dataIndex: "id", key: "id", width: 78 },
      { title: "名称", dataIndex: "name", key: "name", width: 150, ellipsis: true },
      {
        title: "商品 ID",
        dataIndex: "google_product_id",
        key: "google_product_id",
        width: 190,
        ellipsis: true,
      },
      { title: "包名", dataIndex: "pkg_name", key: "pkg_name", width: 180, ellipsis: true },
      { title: "价格", dataIndex: "price", key: "price", width: 96 },
    ];

    const typeColumns: ColumnsType<GoogleProductRow> =
      activeType === 2
        ? [{ title: "优惠价", dataIndex: "first_price", key: "first_price", width: 96 }]
        : [
            { title: "金币", dataIndex: "coin", key: "coin", width: 88, align: "right" },
            { title: "折扣", dataIndex: "bonus", key: "bonus", width: 100 },
          ];

    return [
      ...commonColumns,
      ...typeColumns,
      {
        title: "状态",
        dataIndex: "status",
        key: "status",
        width: 88,
        align: "center",
        render: (value) => productStatusTag(value, true),
      },
      {
        title: "时间",
        key: "time",
        width: 188,
        render: (_: unknown, row) => productTimeCell(row),
      },
      {
        title: "操作",
        key: "action",
        width: 88,
        fixed: "right",
        render: (_: unknown, record) => (
          <Button type="link" size="small" onClick={() => setEditingGoogleRow(record)}>
            编辑
          </Button>
        ),
      },
    ];
  }, [activeType]);

  const columns = activeTab === "package" ? packageColumns : coinColumns;
  const isH5 = activePlatform === "h5";

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        产品管理
      </Typography.Title>

      <Tabs
        activeKey={activePlatform}
        onChange={(key) => {
          setActivePlatform(key as PlatformTabKey);
          setGooglePage(1);
          setEditingRow(null);
          setEditingGoogleRow(null);
        }}
        items={PLATFORM_TAB_ITEMS}
      />

      <Tabs
        activeKey={activeTab}
        onChange={(key) => {
          setActiveTab(key as ProductTabKey);
          setGooglePage(1);
        }}
        items={(isH5 ? TAB_ITEMS : GOOGLE_TAB_ITEMS).map(({ key, label }) => ({ key, label }))}
      />

      <Space style={{ margin: "16px 0" }} align="center">
        <Typography.Text>显示范围</Typography.Text>
        <Switch
          checked={showVisible}
          checkedChildren={isH5 ? "显示" : "启用"}
          unCheckedChildren={isH5 ? "隐藏" : "禁用"}
          onChange={(checked) => {
            setShowVisible(checked);
            setGooglePage(1);
          }}
        />
      </Space>

      {activePlatform === "ios" && activeType === 2 ? (
        <Alert
          type="warning"
          showIcon
          message="修改优惠价前，请先在 App Store Connect 更新对应订阅的优惠价格；确认 Apple 侧修改成功后，再在此处修改优惠金额。"
          style={{ marginBottom: 16 }}
        />
      ) : null}

      <Spin spinning={loading}>
        {!loading && (isH5 ? rows.length === 0 : googleRows.length === 0) ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
        ) : isH5 ? (
          <Table<AdminProductRow>
            rowKey="id"
            columns={columns}
            dataSource={rows}
            pagination={false}
            scroll={{ x: "max-content" }}
            size="middle"
          />
        ) : (
          <Table<GoogleProductRow>
            rowKey="id"
            columns={googleColumns}
            dataSource={googleRows}
            pagination={{
              current: googlePage,
              pageSize: googlePageSize,
              total: googleTotal,
              showSizeChanger: true,
              pageSizeOptions: [24, 50, 100],
              showTotal: (total) => `共 ${total} 条`,
              onChange: (page, pageSize) => {
                setGooglePage(pageSize === googlePageSize ? page : 1);
                setGooglePageSize(pageSize);
              },
            }}
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

      {editingGoogleRow ? (
        <GoogleProductEditModal
          row={editingGoogleRow}
          onClose={() => setEditingGoogleRow(null)}
          onSaved={reload}
        />
      ) : null}
    </div>
  );
}
