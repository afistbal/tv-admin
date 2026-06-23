import { useEffect, useState } from "react";
import { Descriptions, Form, Input, Modal, Radio, message } from "antd";
import { apiPostJson } from "@/api/client";
import type { ApiResult } from "@/api/types";
import type { AdminProductRow, AdminProductSaveBody } from "@/types/adminProduct";
import { formatDateTimeZh } from "@/lib/formatDateTime";

type FormValues = {
  name: string;
  price: string;
  renewal_price?: string;
  bouns?: string;
  status: 0 | 1;
};

type Props = {
  row: AdminProductRow;
  onClose: () => void;
  onSaved: () => void;
};

export function ProductEditModal({ row, onClose, onSaved }: Props) {
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);
  const isCoin = row.type === 2;

  useEffect(() => {
    form.setFieldsValue({
      name: row.name,
      price: row.price,
      renewal_price: isCoin ? undefined : row.renewal_price,
      bouns: isCoin ? row.bouns : undefined,
      status: row.status === 1 ? 1 : 0,
    });
  }, [row, form, isCoin]);

  const handleOk = async () => {
    try {
      const v = await form.validateFields();
      setSaving(true);
      const payload: AdminProductSaveBody = {
        id: row.id,
        name: v.name.trim(),
        price: v.price.trim(),
        status: v.status,
      };
      if (isCoin) {
        payload.bouns = String(v.bouns ?? "").trim();
      } else {
        payload.renewal_price = String(v.renewal_price ?? "").trim();
      }
      const res: ApiResult<unknown> = await apiPostJson("admin/product/save", payload);
      if (res.c !== 0) {
        message.error(res.m || "保存失败");
        return;
      }
      message.success("已保存");
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
      title={`编辑产品 #${row.id}`}
      open
      onCancel={onClose}
      onOk={() => void handleOk()}
      confirmLoading={saving}
      width={520}
      destroyOnHidden
      maskClosable={!saving}
    >
      <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
        <Descriptions.Item label="ID">{row.id}</Descriptions.Item>
        <Descriptions.Item label="类型">{isCoin ? "金币" : "套餐"}</Descriptions.Item>
        {isCoin ? <Descriptions.Item label="金币">{row.coin}</Descriptions.Item> : null}
        <Descriptions.Item label="创建时间">
          {row.created_at ? formatDateTimeZh(row.created_at) : "—"}
        </Descriptions.Item>
        <Descriptions.Item label="更新时间">
          {row.updated_at ? formatDateTimeZh(row.updated_at) : "—"}
        </Descriptions.Item>
      </Descriptions>

      <Form form={form} layout="vertical" requiredMark="optional">
        <Form.Item label="名称" name="name" rules={[{ required: true, message: "请输入名称" }]}>
          <Input maxLength={128} />
        </Form.Item>
        <Form.Item label="价格" name="price" rules={[{ required: true, message: "请输入价格" }]}>
          <Input maxLength={32} />
        </Form.Item>
        {isCoin ? (
          <Form.Item
            label="赠送比例"
            name="bouns"
            rules={[{ required: true, message: "请输入赠送比例" }]}
          >
            <Input maxLength={32} placeholder="如 0.40" />
          </Form.Item>
        ) : (
          <Form.Item
            label="续费价格"
            name="renewal_price"
            rules={[{ required: true, message: "请输入续费价格" }]}
          >
            <Input maxLength={32} />
          </Form.Item>
        )}
        <Form.Item label="状态" name="status" rules={[{ required: true, message: "请选择状态" }]}>
          <Radio.Group>
            <Radio value={1}>显示</Radio>
            <Radio value={0}>隐藏</Radio>
          </Radio.Group>
        </Form.Item>
      </Form>
    </Modal>
  );
}
