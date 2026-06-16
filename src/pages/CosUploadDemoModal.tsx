import { useCallback, useRef, useState } from "react";
import { Button, Modal, Progress, Typography, message } from "antd";
import { buildCosObjectKey, readCosUploadConfig } from "@/lib/cosUploadConfig";
import { buildHashedUploadFileName } from "@/lib/cosDramaUpload";
import { uploadDramaAssetDemo } from "@/lib/dramaPublishUpload";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CosUploadDemoModal({ open, onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [resultKey, setResultKey] = useState<string | null>(null);
  const [cosKey, setCosKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setUploading(false);
    setProgress(0);
    setFileName(null);
    setResultKey(null);
    setCosKey(null);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    if (uploading) {
      return;
    }
    reset();
    onClose();
  }, [onClose, reset, uploading]);

  const handlePick = useCallback(() => {
    if (uploading) {
      return;
    }
    inputRef.current?.click();
  }, [uploading]);

  const handleFile = useCallback(async (file: File | undefined) => {
    if (!file) {
      return;
    }
    if (!/\.(mp4|mov)$/i.test(file.name)) {
      message.warning("Demo 仅支持 mp4 / mov");
      return;
    }

    reset();
    setUploading(true);
    setFileName(file.name);
    setProgress(0);

    const cfg = readCosUploadConfig();
    const hashed = await buildHashedUploadFileName(file);
    const fullKey = buildCosObjectKey(cfg.keyPrefix || "add-movies", hashed);
    setCosKey(fullKey);

    try {
      const key = await uploadDramaAssetDemo(file, setProgress);
      setResultKey(key);
      setProgress(100);
      message.success("上传成功");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "上传失败";
      setError(msg);
      message.error(msg);
    } finally {
      setUploading(false);
    }
  }, [reset]);

  const prefix = readCosUploadConfig().keyPrefix || "add-movies";

  return (
    <Modal
      title="Demo · COS 测试上传"
      open={open}
      onCancel={handleClose}
      maskClosable={!uploading}
      destroyOnHidden
      width={520}
      footer={
        <Button onClick={handleClose} disabled={uploading}>
          关闭
        </Button>
      }
    >
      <Typography.Paragraph type="secondary" style={{ marginBottom: 12, fontSize: 13 }}>
        流程：GET <Typography.Text code>oss/form</Typography.Text> → POST COS，目录前缀{" "}
        <Typography.Text code>{prefix}/</Typography.Text>
      </Typography.Paragraph>

      <Button type="primary" loading={uploading} onClick={handlePick}>
        选择 mp4 上传
      </Button>

      <input
        ref={inputRef}
        type="file"
        accept=".mp4,.mov,video/mp4,video/quicktime"
        style={{ display: "none" }}
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {fileName ? (
        <div style={{ marginTop: 16 }}>
          <Typography.Text type="secondary">文件：</Typography.Text>
          <Typography.Text>{fileName}</Typography.Text>
        </div>
      ) : null}

      {cosKey ? (
        <div style={{ marginTop: 8 }}>
          <Typography.Text type="secondary">COS Key：</Typography.Text>
          <Typography.Text copyable={{ text: cosKey }}>{cosKey}</Typography.Text>
        </div>
      ) : null}

      {uploading || progress > 0 ? (
        <Progress percent={progress} style={{ marginTop: 16 }} status={error ? "exception" : undefined} />
      ) : null}

      {resultKey ? (
        <div style={{ marginTop: 12 }}>
          <Typography.Text type="success">publish key：{resultKey}</Typography.Text>
        </div>
      ) : null}

      {error ? (
        <Typography.Paragraph type="danger" style={{ marginTop: 12, marginBottom: 0 }}>
          {error}
        </Typography.Paragraph>
      ) : null}
    </Modal>
  );
}
