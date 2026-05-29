import { Descriptions, Modal, Space, Tag, Typography } from "antd";
import {
  buildOrderPaymentDetailSections,
  formatPaymentMethodCombo,
  formatPaymentMethodComboLabel,
  normalizeOrderPaymentPayload,
  type PaymentDetailSection,
} from "@/lib/orderPaymentDetailDisplay";
import { formatDateTimeZh } from "@/lib/formatDateTime";

type OrderPaymentDetailModalProps = {
  open: boolean;
  data: Record<string, unknown> | null;
  onClose: () => void;
};

function formatRowValue(label: string, value: string): string {
  if (label.includes("时间") && value !== "—") {
    return formatDateTimeZh(value);
  }
  return value;
}

function PaymentSections({ sections }: { sections: PaymentDetailSection[] }) {
  return (
    <>
      {sections.map((section) => (
        <div key={section.title} style={{ marginBottom: 20 }}>
          <Typography.Title level={5} style={{ marginTop: 0 }}>
            {section.title}
          </Typography.Title>
          <Descriptions bordered column={1} size="small">
            {section.rows.map((r) => (
              <Descriptions.Item key={`${section.title}-${r.label}`} label={r.label}>
                {formatRowValue(r.label, r.value)}
              </Descriptions.Item>
            ))}
          </Descriptions>
        </div>
      ))}
    </>
  );
}

export function OrderPaymentDetailModal({ open, data, onClose }: OrderPaymentDetailModalProps) {
  const normalized = data ? normalizeOrderPaymentPayload(data) : null;
  const sections = normalized ? buildOrderPaymentDetailSections(normalized) : [];
  const combo = normalized ? formatPaymentMethodCombo(normalized) : null;
  const comboLabel = normalized ? formatPaymentMethodComboLabel(normalized) : null;

  return (
    <Modal title="支付明细" open={open} onCancel={onClose} footer={null} width={720} destroyOnHidden>
      {normalized && sections.length > 0 ? (
        <>
          {combo ? (
            <Space style={{ marginBottom: 16 }} wrap>
              <Typography.Text type="secondary">支付组合</Typography.Text>
              <Tag color="blue">{comboLabel ?? combo}</Tag>
              {comboLabel && comboLabel !== combo ? (
                <Typography.Text type="secondary" code>
                  {combo}
                </Typography.Text>
              ) : null}
            </Space>
          ) : null}
          <PaymentSections sections={sections} />
        </>
      ) : (
        <Typography.Text type="secondary">暂无支付明细</Typography.Text>
      )}
    </Modal>
  );
}
