import { useEffect, useState } from "react";
import { Descriptions, Form, Input, Modal, Radio, message } from "antd";
import { apiPostJson } from "@/api/client";
import type { ApiResult } from "@/api/types";
import type { GoogleProductRow, GoogleProductSaveBody } from "@/types/googleProduct";

type FormValues = {
  name: string;
  price: string;
  first_price?: string;
  coin?: string;
  bonus?: string;
  status: 0 | 1;
};

type Props = {
  row: GoogleProductRow;
  onClose: () => void;
  onSaved: () => void;
};

const PRICE_PATTERN = /^\d+(?:\.\d{1,2})?$/;

function platformLabel(platform: GoogleProductRow["platform"]): string {
  if (platform === "ios") {
    return "IOS";
  }
  if (platform === "tk") {
    return "TikTok";
  }
  return "Android";
}

export function GoogleProductEditModal({ row, onClose, onSaved }: Props) {
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    form.setFieldsValue({
      name: row.name,
      price: row.price,
      first_price: row.type === 2 ? row.first_price : undefined,
      coin: row.type === 1 ? String(row.coin ?? 0) : undefined,
      bonus: row.type === 1 ? String(row.bonus ?? 0) : undefined,
      status: row.status === 1 ? 1 : 0,
    });
  }, [form, row]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload: GoogleProductSaveBody = {
        id: row.id,
        name: values.name.trim(),
        price: values.price.trim(),
        status: values.status,
      };
      if (row.type === 1) {
        payload.coin = Number(String(values.coin ?? "").trim());
        payload.bonus = Number(String(values.bonus ?? "").trim());
      } else {
        payload.first_price = String(values.first_price ?? "").trim();
      }
      const res: ApiResult<unknown> = await apiPostJson("admin/google-product/save", payload);
      if (res.c !== 0) {
        message.error(res.m || "保存失败");
        return;
      }
      message.success("已保存");
      onSaved();
      onClose();
    } catch {
      /* 表单校验失败时由 Form 展示错误 */
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`编辑 ${platformLabel(row.platform)} 商品 #${row.id}`}
      open
      onCancel={onClose}
      onOk={() => void handleOk()}
      confirmLoading={saving}
      width={520}
      destroyOnHidden
      maskClosable={!saving}
    >
      <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
        <Descriptions.Item label="商品 ID">{row.google_product_id || "—"}</Descriptions.Item>
        <Descriptions.Item label="包名">{row.pkg_name || "—"}</Descriptions.Item>
        <Descriptions.Item label="商品类型">
          {row.type === 2 ? "订阅商品" : "金币商品"}
        </Descriptions.Item>
      </Descriptions>

      <Form form={form} layout="vertical" requiredMark="optional">
        <Form.Item
          label="名称"
          name="name"
          rules={[
            { required: true, message: "请输入名称" },
            { max: 255, message: "名称最多 255 个字符" },
          ]}
        >
          <Input maxLength={255} />
        </Form.Item>
        <Form.Item
          label="价格"
          name="price"
          rules={[
            { required: true, message: "请输入价格" },
            { pattern: PRICE_PATTERN, message: "请输入非负金额，最多 2 位小数" },
          ]}
        >
          <Input maxLength={32} inputMode="decimal" />
        </Form.Item>
        {row.type === 2 ? (
          <Form.Item
            label="优惠价"
            name="first_price"
            rules={[
              { required: true, message: "请输入优惠价" },
              { pattern: PRICE_PATTERN, message: "请输入非负金额，最多 2 位小数" },
            ]}
          >
            <Input maxLength={32} inputMode="decimal" />
          </Form.Item>
        ) : null}
        {row.type === 1 ? (
          <>
            <Form.Item
              label="金币"
              name="coin"
              rules={[
                { required: true, message: "请输入金币" },
                { pattern: /^\d+$/, message: "请输入非负整数" },
              ]}
            >
              <Input maxLength={16} inputMode="numeric" />
            </Form.Item>
            <Form.Item
              label="折扣"
              name="bonus"
              rules={[
                { required: true, message: "请输入折扣" },
                { pattern: /^\d+(?:\.\d+)?$/, message: "请输入非负数" },
              ]}
            >
              <Input maxLength={32} inputMode="decimal" />
            </Form.Item>
          </>
        ) : null}
        <Form.Item label="状态" name="status" rules={[{ required: true, message: "请选择状态" }]}>
          <Radio.Group>
            <Radio value={1}>启用</Radio>
            <Radio value={0}>禁用</Radio>
          </Radio.Group>
        </Form.Item>
      </Form>
    </Modal>
  );
}
