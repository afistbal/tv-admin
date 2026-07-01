import { useEffect, useState } from "react";
import { Button, Descriptions, Form, Input, InputNumber, Modal, Radio, Space, message } from "antd";
import { apiPostJson } from "@/api/client";
import type { ApiResult } from "@/api/types";
import type { AdminProductRow, AdminProductSaveBody } from "@/types/adminProduct";
import { formatDateTimeZh } from "@/lib/formatDateTime";
import { productDiscountsFromExtra, stringifyProductExtraWithDiscounts } from "@/lib/productExtra";
import styles from "./ProductEditModal.module.css";

type FormValues = {
  name: string;
  price: string;
  renewal_price?: string;
  coin?: string;
  bouns?: string;
  status: 0 | 1;
  discounts?: { type?: number; price?: string }[];
};

type Props = {
  row: AdminProductRow;
  onClose: () => void;
  onSaved: () => void;
};

function discountLimitForProduct(row: AdminProductRow): number {
  const name = row.name.trim().toLowerCase();
  if (name === "quarterly") {
    return 1;
  }
  if (name === "weekly") {
    return 2;
  }
  return 2;
}

function nextDiscountType(row: AdminProductRow, discounts: FormValues["discounts"]): number | null {
  const limit = discountLimitForProduct(row);
  const used = new Set((discounts ?? []).map((item) => Number(item?.type)).filter((type) => Number.isFinite(type)));
  for (let type = 1; type <= limit; type += 1) {
    if (!used.has(type)) {
      return type;
    }
  }
  return null;
}

export function ProductEditModal({ row, onClose, onSaved }: Props) {
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);
  const isCoin = row.type === 2;
  const discountLimit = discountLimitForProduct(row);

  useEffect(() => {
    form.setFieldsValue({
      name: row.name,
      price: row.price,
      renewal_price: isCoin ? undefined : row.renewal_price,
      coin: isCoin ? String(row.coin ?? "") : undefined,
      bouns: isCoin ? row.bouns : undefined,
      status: row.status === 1 ? 1 : 0,
      discounts: productDiscountsFromExtra(row.extra),
    });
  }, [row, form, isCoin]);

  const handleOk = async () => {
    try {
      const v = await form.validateFields();
      if ((v.discounts?.length ?? 0) > discountLimit) {
        message.warning(`挽留优惠最多 ${discountLimit} 个`);
        return;
      }
      setSaving(true);
      const payload: AdminProductSaveBody = {
        id: row.id,
        name: v.name.trim(),
        price: v.price.trim(),
        status: v.status,
      };
      if (isCoin) {
        payload.coin = Number(String(v.coin ?? "").trim());
        payload.bouns = String(v.bouns ?? "").trim();
      } else {
        payload.renewal_price = String(v.renewal_price ?? "").trim();
      }
      const extra = stringifyProductExtraWithDiscounts(
        row.extra,
        (v.discounts ?? []).map((item) => ({
          type: Number(item?.type),
          price: String(item?.price ?? "").trim(),
        })),
      );
      if (extra !== undefined) {
        payload.extra = extra;
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
          <>
            <Form.Item
              label="金币"
              name="coin"
              rules={[
                { required: true, message: "请输入金币" },
                { pattern: /^\d+$/, message: "金币须为正整数" },
              ]}
            >
              <Input maxLength={16} inputMode="numeric" placeholder="如 2000" />
            </Form.Item>
            <Form.Item
              label="赠送比例"
              name="bouns"
              rules={[{ required: true, message: "请输入赠送比例" }]}
            >
              <Input maxLength={32} placeholder="如 0.40" />
            </Form.Item>
          </>
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

        <Form.List name="discounts">
          {(fields, { add, remove }) => (
            <div>
              <div className={styles.discountHeader}>
                <span className={styles.discountTitle}>挽留优惠（最多 {discountLimit} 个）</span>
                <Button
                  size="small"
                  disabled={fields.length >= discountLimit}
                  onClick={() => {
                    const current = form.getFieldValue("discounts") as FormValues["discounts"];
                    const type = nextDiscountType(row, current);
                    if (type == null) {
                      return;
                    }
                    add({ type, price: "" });
                  }}
                >
                  新增挽留优惠
                </Button>
              </div>
              {fields.length === 0 ? (
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="挽留优惠">暂无</Descriptions.Item>
                </Descriptions>
              ) : (
                <Space direction="vertical" size={8} style={{ width: "100%" }}>
                  {fields.map((field) => (
                    <div key={field.key} className={styles.discountRow}>
                      <Form.Item
                        {...field}
                        label="优化弹窗"
                        name={[field.name, "type"]}
                        rules={[{ required: true, message: "请输入序号" }]}
                      >
                        <InputNumber disabled min={1} precision={0} style={{ width: "100%" }} />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        label="优惠价"
                        name={[field.name, "price"]}
                        rules={[{ required: true, message: "请输入优惠价" }]}
                      >
                        <Input maxLength={32} placeholder="如 0.02" />
                      </Form.Item>
                      <Form.Item label=" ">
                        <Button danger onClick={() => remove(field.name)}>
                          删除
                        </Button>
                      </Form.Item>
                    </div>
                  ))}
                </Space>
              )}
            </div>
          )}
        </Form.List>
      </Form>
    </Modal>
  );
}
