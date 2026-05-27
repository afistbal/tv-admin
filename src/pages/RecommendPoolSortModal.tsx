import { useEffect, useState } from "react";
import { Form, Input, Modal, message } from "antd";
import { apiPostJson } from "@/api/client";
import type { ApiResult } from "@/api/types";
import type { AdminPoolRow } from "@/types/adminPool";

type Props = {
  row: AdminPoolRow | null;
  onClose: () => void;
  onSaved: () => void;
};

export function RecommendPoolSortModal({ row, onClose, onSaved }: Props) {
  const [form] = Form.useForm<{ sort: string }>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (row) {
      form.setFieldsValue({ sort: String(row.sort ?? "") });
    }
  }, [row, form]);

  const handleOk = async () => {
    if (!row) {
      return;
    }
    let values: { sort: string };
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    const n = Number(values.sort.trim());
    if (!Number.isFinite(n)) {
      message.warning("排序须为数字");
      return;
    }
    setSaving(true);
    try {
      const res: ApiResult<unknown> = await apiPostJson("admin/pools/sort", {
        orders: [{ id: String(row.id), sort: String(n) }],
      });
      if (res.c !== 0) {
        message.error(res.m || "保存失败");
        return;
      }
      message.success("排序已更新");
      onSaved();
      onClose();
    } catch {
      message.error("网络异常");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="编辑排序"
      open={row != null}
      onCancel={onClose}
      onOk={() => void handleOk()}
      confirmLoading={saving}
      destroyOnHidden
      okText="保存"
      cancelText="取消"
    >
      <TypographyMuted row={row} />
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <Form.Item
          name="sort"
          label="推荐序号（sort）"
          rules={[{ required: true, message: "请输入排序数字" }]}
        >
          <Input inputMode="numeric" placeholder="数值越大越靠前" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function TypographyMuted({ row }: { row: AdminPoolRow | null }) {
  if (!row?.movie) {
    return null;
  }
  return (
    <p style={{ margin: 0, color: "rgba(0,0,0,0.45)", fontSize: 13 }}>
      {String(row.movie.title ?? "")}（ID {row.movie_id}）
    </p>
  );
}
