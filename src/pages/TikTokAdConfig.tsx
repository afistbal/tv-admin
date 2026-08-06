import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Space,
  Switch,
  Table,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { apiDelete, apiGet, apiPostJson, apiPutJson, getApiErrorMessage } from "@/api/client";

type TikTokAdRow = {
  id: number;
  name: string;
  ad_id: string;
  enabled: boolean;
  sort: number;
  created_at?: string;
  updated_at?: string;
};

type TikTokAdListPayload = {
  current_page?: number;
  data?: TikTokAdRow[];
  per_page?: number;
  total?: number;
  last_page?: number;
};

type TikTokAdFormValues = {
  name: string;
  ad_id: string;
  enabled: boolean;
  sort: number;
};

function adPayload(values: TikTokAdFormValues): Record<string, unknown> {
  return {
    name: values.name.trim(),
    ad_id: values.ad_id.trim(),
    enabled: values.enabled,
    sort: Number(values.sort) || 0,
  };
}

function rowPayload(row: TikTokAdRow, patch: Partial<TikTokAdFormValues> = {}): Record<string, unknown> {
  return adPayload({
    name: patch.name ?? row.name,
    ad_id: patch.ad_id ?? row.ad_id,
    enabled: patch.enabled ?? Boolean(row.enabled),
    sort: patch.sort ?? (Number(row.sort) || 0),
  });
}

export function TikTokAdConfig() {
  const [form] = Form.useForm<TikTokAdFormValues>();
  const [rows, setRows] = useState<TikTokAdRow[]>([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(24);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<TikTokAdRow | null>(null);
  const [loadingDetailId, setLoadingDetailId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchList = useCallback(async (targetPage: number) => {
    setLoading(true);
    try {
      const res = await apiGet<TikTokAdListPayload>("admin/tiktok-ads", { page: targetPage });
      if (res.c !== 0) {
        message.error(getApiErrorMessage(res, "TikTok 广告位加载失败"));
        return;
      }
      const data = Array.isArray(res.d?.data) ? res.d.data : [];
      const nextPerPage = Number(res.d?.per_page) || 24;
      const currentPage = Number(res.d?.current_page) || targetPage;
      const explicitTotal = Number(res.d?.total);
      const inferredTotal =
        (currentPage - 1) * nextPerPage + data.length + (data.length >= nextPerPage ? 1 : 0);
      setRows(data.map((row) => ({ ...row, enabled: Boolean(row.enabled), sort: Number(row.sort) || 0 })));
      setPage(currentPage);
      setPerPage(nextPerPage);
      setTotal(Number.isFinite(explicitTotal) && explicitTotal >= 0 ? explicitTotal : inferredTotal);
    } catch {
      message.error("TikTok 广告位加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchList(page);
  }, [fetchList, page]);

  const openAdd = useCallback(() => {
    setEditingRow(null);
    form.setFieldsValue({
      name: "",
      ad_id: "",
      enabled: true,
      sort: 0,
    });
    setEditorOpen(true);
  }, [form]);

  const openEdit = useCallback(
    async (row: TikTokAdRow) => {
      setLoadingDetailId(row.id);
      try {
        const res = await apiGet<TikTokAdRow>(`admin/tiktok-ads/${row.id}`);
        if (res.c !== 0) {
          message.error(getApiErrorMessage(res, "广告位详情加载失败"));
          return;
        }
        const detail = res.d;
        setEditingRow(detail);
        form.setFieldsValue({
          name: String(detail.name ?? ""),
          ad_id: String(detail.ad_id ?? ""),
          enabled: Boolean(detail.enabled),
          sort: Number(detail.sort) || 0,
        });
        setEditorOpen(true);
      } catch {
        message.error("广告位详情加载失败");
      } finally {
        setLoadingDetailId(null);
      }
    },
    [form],
  );

  const saveEditor = useCallback(async () => {
    let values: TikTokAdFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    setSaving(true);
    try {
      const payload = adPayload(values);
      const res = editingRow
        ? await apiPutJson<TikTokAdRow>(`admin/tiktok-ads/${editingRow.id}`, payload)
        : await apiPostJson<TikTokAdRow>("admin/tiktok-ads", payload);
      if (res.c !== 0) {
        message.error(getApiErrorMessage(res, "广告位保存失败"));
        return;
      }
      message.success(editingRow ? "广告位修改成功" : "广告位新增成功");
      setEditorOpen(false);
      const targetPage = editingRow ? page : 1;
      if (targetPage === page) {
        await fetchList(targetPage);
      } else {
        setPage(targetPage);
      }
    } catch {
      message.error("广告位保存失败");
    } finally {
      setSaving(false);
    }
  }, [editingRow, fetchList, form, page]);

  const toggleEnabled = useCallback(async (row: TikTokAdRow, enabled: boolean) => {
    setTogglingId(row.id);
    try {
      const res = await apiPutJson<TikTokAdRow>(`admin/tiktok-ads/${row.id}`, rowPayload(row, { enabled }));
      if (res.c !== 0) {
        message.error(getApiErrorMessage(res, "状态修改失败"));
        return;
      }
      setRows((current) => current.map((item) => (item.id === row.id ? { ...item, enabled } : item)));
      message.success(enabled ? "已启用" : "已停用");
    } catch {
      message.error("状态修改失败");
    } finally {
      setTogglingId(null);
    }
  }, []);

  const deleteRow = useCallback(
    async (row: TikTokAdRow) => {
      setDeletingId(row.id);
      try {
        const res = await apiDelete<unknown>(`admin/tiktok-ads/${row.id}`);
        if (res.c !== 0) {
          message.error(getApiErrorMessage(res, "广告位删除失败"));
          return;
        }
        message.success("广告位删除成功");
        const targetPage = rows.length === 1 && page > 1 ? page - 1 : page;
        if (targetPage === page) {
          await fetchList(targetPage);
        } else {
          setPage(targetPage);
        }
      } catch {
        message.error("广告位删除失败");
      } finally {
        setDeletingId(null);
      }
    },
    [fetchList, page, rows.length],
  );

  const columns: ColumnsType<TikTokAdRow> = [
    {
      title: "名称",
      dataIndex: "name",
      key: "name",
      width: 220,
      render: (value: string) => <Typography.Text copyable={{ text: value }}>{value || "—"}</Typography.Text>,
    },
    { title: "类型", key: "type", width: 140, render: () => "奖励性视频广告" },
    {
      title: "广告位 ID",
      dataIndex: "ad_id",
      key: "ad_id",
      width: 240,
      render: (value: string) => <Typography.Text copyable={{ text: value }}>{value || "—"}</Typography.Text>,
    },
    { title: "排序", dataIndex: "sort", key: "sort", width: 80, align: "center" },
    {
      title: "状态",
      dataIndex: "enabled",
      key: "enabled",
      width: 130,
      render: (enabled: boolean, row) => (
        <Space size={6}>
          <Switch
            size="small"
            checked={Boolean(enabled)}
            loading={togglingId === row.id}
            onChange={(checked) => void toggleEnabled(row, checked)}
          />
          <span>{enabled ? "已启用" : "已停用"}</span>
        </Space>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 130,
      fixed: "right",
      render: (_, row) => (
        <Space size={4}>
          <Button type="link" size="small" loading={loadingDetailId === row.id} onClick={() => void openEdit(row)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除这个广告位？"
            description="删除后客户端不能再创建新的广告解锁会话。"
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true, loading: deletingId === row.id }}
            onConfirm={() => void deleteRow(row)}
          >
            <Button type="link" danger size="small">
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <Typography.Text type="secondary">管理 TikTok 应用内奖励视频广告位。</Typography.Text>
        <Button type="primary" onClick={openAdd}>
          新增广告位
        </Button>
      </div>

      <Table<TikTokAdRow>
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={loading}
        bordered
        size="middle"
        scroll={{ x: 940 }}
        pagination={{
          current: page,
          pageSize: perPage,
          total,
          showSizeChanger: false,
          hideOnSinglePage: total <= perPage,
          onChange: (nextPage) => setPage(nextPage),
        }}
        locale={{ emptyText: loading ? "加载中..." : "暂无 TikTok 广告位" }}
      />

      <Modal
        title={editingRow ? "编辑 TikTok 广告位" : "新增 TikTok 广告位"}
        open={editorOpen}
        width={640}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
        onOk={() => void saveEditor()}
        onCancel={() => setEditorOpen(false)}
        destroyOnClose
      >
        <Form<TikTokAdFormValues> form={form} layout="vertical" requiredMark="optional">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: "请输入名称" }, { max: 100 }]}>
            <Input placeholder="例如 TikTok Reward Android" maxLength={100} />
          </Form.Item>
          <Form.Item name="ad_id" label="广告位 ID" rules={[{ required: true, message: "请输入广告位 ID" }]}>
            <Input placeholder="例如 tt-reward-video-001" />
          </Form.Item>
          <Form.Item name="sort" label="排序" rules={[{ required: true, message: "请输入排序" }]}>
            <InputNumber precision={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="enabled" label="启用状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
