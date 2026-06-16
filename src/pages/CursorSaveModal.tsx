import { useCallback, useEffect, useState } from "react";
import { Form, Input, Modal, Select, Typography, message } from "antd";
import { fetchCursorSources, saveCursor } from "@/lib/cursorApi";

type FormValues = {
  source: string;
  value: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CursorSaveModal({ open, onClose }: Props) {
  const [form] = Form.useForm<FormValues>();
  const [loadingSources, setLoadingSources] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sourceOptions, setSourceOptions] = useState<{ value: string; label: string }[]>([]);

  const loadSources = useCallback(async () => {
    setLoadingSources(true);
    try {
      const res = await fetchCursorSources();
      if (res.c !== 0) {
        message.error(res.m || "抓取源加载失败");
        setSourceOptions([]);
        return;
      }
      const options = (res.d ?? []).map((item) => ({ value: item.key, label: item.label }));
      setSourceOptions(options);
      if (options.length === 0) {
        message.warning("暂无可用抓取源");
      }
    } catch {
      message.error("网络异常");
      setSourceOptions([]);
    } finally {
      setLoadingSources(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      form.resetFields();
      setSourceOptions([]);
      return;
    }
    void loadSources();
  }, [open, form, loadSources]);

  const handleOk = async () => {
    try {
      const v = await form.validateFields();
      const valueNum = Number(v.value.trim());
      if (!Number.isFinite(valueNum)) {
        message.warning("游标值必须是数字");
        return;
      }
      setSaving(true);
      const res = await saveCursor({
        source: v.source,
        value: valueNum,
      });
      if (res.c !== 0) {
        message.error(res.m || "保存失败");
        return;
      }
      const path = res.d?.path?.trim();
      message.success(path ? `游标已保存：${path}` : "游标已保存");
      onClose();
    } catch {
      /* validate */
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="重拉剧游标"
      open={open}
      onCancel={onClose}
      onOk={() => void handleOk()}
      confirmLoading={saving}
      okText="保存"
      cancelText="取消"
      destroyOnHidden
      width={440}
    >
      <Typography.Paragraph type="secondary" style={{ marginBottom: 16, fontSize: 13 }}>
        设置抓取游标后，将写入服务端日志文件供重拉任务使用。
      </Typography.Paragraph>
      <Form form={form} layout="vertical">
        <Form.Item name="source" label="游标源" rules={[{ required: true, message: "请选择游标源" }]}>
          <Select
            placeholder="请选择抓取源"
            loading={loadingSources}
            options={sourceOptions}
            showSearch
            optionFilterProp="label"
          />
        </Form.Item>
        <Form.Item
          name="value"
          label="游标值"
          rules={[
            { required: true, message: "请填写游标值" },
            { pattern: /^\d+$/, message: "游标值须为数字" },
          ]}
        >
          <Input placeholder="如 5001" inputMode="numeric" maxLength={16} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
