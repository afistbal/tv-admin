import { useEffect, useState } from "react";
import { Form, Input, Modal, Radio, Select, message } from "antd";
import { apiPostJson } from "@/api/client";
import type { ApiResult } from "@/api/types";
import type { AdminSourceFormRow } from "@/types/adminSourceList";

const TYPE_OPTIONS = [
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
];

type FormValues = {
  source: string;
  type: string;
  status: 0 | 1;
  sourceId: string;
  accessToken: string;
};

type Props = {
  mode: "create" | "edit";
  row: AdminSourceFormRow;
  onClose: () => void;
  onSaved: () => void;
};

export function PromotionSourceEditModal({ mode, row, onClose, onSaved }: Props) {
  const isCreate = mode === "create";
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    form.setFieldsValue({
      source: row.source ?? "",
      type: row.type ?? "facebook",
      status: row.status === 0 ? 0 : 1,
      sourceId: row.source_id ?? "",
      accessToken: row.access_token ?? "",
    });
  }, [row, form]);

  const handleOk = async () => {
    try {
      const v = await form.validateFields();
      setSaving(true);
      const body: Record<string, string | number> = {
        source: v.source.trim(),
        type: v.type,
        status: v.status,
        sourceId: v.sourceId.trim(),
        accessToken: v.accessToken.trim(),
      };
      if (!isCreate && row.id != null && Number.isFinite(row.id)) {
        body.id = row.id;
      }
      const res: ApiResult<unknown> = await apiPostJson("admin/source/save", body);
      if (res.c !== 0) {
        message.error(res.m || "保存失败");
        return;
      }
      message.success(isCreate ? "已新增" : "已保存");
      onSaved();
      onClose();
    } catch {
      /* validate */
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={isCreate ? "新增推广" : `编辑推广 #${row.id}`}
      open
      onCancel={onClose}
      onOk={() => void handleOk()}
      confirmLoading={saving}
      width={480}
      destroyOnHidden
      maskClosable={!saving}
      okText={isCreate ? "确认新增" : "保存"}
      cancelText="取消"
    >
      <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
        <Form.Item name="source" label="来源" rules={[{ required: true, message: "请输入来源" }]}>
          <Input placeholder="如 A100A100" maxLength={64} />
        </Form.Item>
        <Form.Item name="type" label="类型" rules={[{ required: true, message: "请选择类型" }]}>
          <Select options={TYPE_OPTIONS} />
        </Form.Item>
        <Form.Item name="status" label="状态" rules={[{ required: true }]}>
          <Radio.Group>
            <Radio value={1}>启用</Radio>
            <Radio value={0}>停用</Radio>
          </Radio.Group>
        </Form.Item>
        <Form.Item name="sourceId" label="像素id" rules={[{ required: true, message: "请输入像素id" }]}>
          <Input placeholder="source_id" maxLength={128} />
        </Form.Item>
        <Form.Item name="accessToken" label="Access Token">
          <Input.TextArea placeholder="accessToken" rows={3} maxLength={2048} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
