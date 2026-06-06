import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Input, Modal, Space, Typography, message } from "antd";
import {
  type BatchWatermarkLogLine,
  parseWatermarkMovieIds,
  runBatchEnableWatermark,
} from "@/lib/batchWatermark";
import styles from "./BatchWatermarkModal.module.css";

const { TextArea } = Input;

type Props = {
  open: boolean;
  staticBase: string | null;
  onClose: () => void;
  onCompleted: () => void;
};

function logMessageClass(status: BatchWatermarkLogLine["status"]): string {
  if (status === "success") {
    return styles.logMessageSuccess;
  }
  if (status === "missing") {
    return styles.logMessageMissing;
  }
  return styles.logMessageError;
}

export function BatchWatermarkModal({ open, staticBase, onClose, onCompleted }: Props) {
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<BatchWatermarkLogLine[]>([]);
  const [summary, setSummary] = useState<{ success: number; fail: number; missing: number } | null>(null);
  const logPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      setInput("");
      setRunning(false);
      setLogs([]);
      setSummary(null);
    }
  }, [open]);

  useEffect(() => {
    const panel = logPanelRef.current;
    if (!panel) {
      return;
    }
    panel.scrollTop = panel.scrollHeight;
  }, [logs]);

  const failedIds = useMemo(
    () => logs.filter((line) => line.status !== "success").map((line) => line.movieId),
    [logs],
  );

  const handleClose = useCallback(() => {
    if (running) {
      return;
    }
    onClose();
  }, [onClose, running]);

  const handleStart = useCallback(async () => {
    const movieIds = parseWatermarkMovieIds(input);
    if (movieIds.length === 0) {
      message.warning("请输入有效的文件名，如 9706.webp");
      return;
    }

    setRunning(true);
    setLogs([]);
    setSummary(null);

    const nextLogs: BatchWatermarkLogLine[] = [];
    const result = await runBatchEnableWatermark(movieIds, staticBase, (line) => {
      nextLogs.push(line);
      setLogs([...nextLogs]);
    });

    setSummary({
      success: result.successCount,
      fail: result.failCount,
      missing: result.missingCount,
    });
    setRunning(false);
    onCompleted();

    if (result.successCount === movieIds.length) {
      message.success(`已全部开启水印（${result.successCount} 条）`);
    } else if (result.successCount > 0) {
      message.warning(`完成：成功 ${result.successCount}，失败 ${result.failCount + result.missingCount}`);
    } else {
      message.error("批量开启失败，请查看日志");
    }
  }, [input, onCompleted, staticBase]);

  const copyFailedIds = useCallback(async () => {
    if (failedIds.length === 0) {
      message.info("没有失败记录");
      return;
    }
    const text = failedIds.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      message.success("已复制失败 ID");
    } catch {
      message.error("复制失败");
    }
  }, [failedIds]);

  return (
    <Modal
      title="批量开启水印"
      open={open}
      onCancel={handleClose}
      maskClosable={!running}
      destroyOnHidden
      width={640}
      footer={
        <Space>
          {failedIds.length > 0 ? (
            <Button onClick={() => void copyFailedIds()} disabled={running}>
              复制失败 ID
            </Button>
          ) : null}
          <Button onClick={handleClose} disabled={running}>
            关闭
          </Button>
          <Button type="primary" loading={running} disabled={!input.trim()} onClick={() => void handleStart()}>
            确定
          </Button>
        </Space>
      }
    >
      <Typography.Text type="secondary" className={styles.hint}>
        每行一个文件名，支持 <Typography.Text code>9706.webp</Typography.Text> 或纯数字 ID；将依次校验
        movie_images 是否存在，再调用开启水印接口（is_rename: 1）。
      </Typography.Text>
      <TextArea
        className={styles.inputArea}
        rows={10}
        value={input}
        disabled={running}
        placeholder={"9706.webp\n9707.webp\n9709.webp"}
        onChange={(e) => setInput(e.target.value)}
      />

      {logs.length > 0 ? (
        <div className={styles.logSection}>
          <div className={styles.logHead}>
            <Typography.Text strong>执行日志</Typography.Text>
            {summary ? (
              <Typography.Text className={styles.logSummary}>
                成功 {summary.success} · 资源不存在 {summary.missing} · 失败 {summary.fail}
              </Typography.Text>
            ) : running ? (
              <Typography.Text className={styles.logSummary}>执行中…</Typography.Text>
            ) : null}
          </div>
          <div ref={logPanelRef} className={styles.logPanel}>
            {logs.map((line) => (
              <div key={line.key} className={styles.logLine}>
                <Typography.Text className={styles.logIdCopy} copyable={{ text: String(line.movieId) }}>
                  <span className={styles.logId}>#{line.movieId}</span>
                </Typography.Text>
                <span className={`${styles.logMessage} ${logMessageClass(line.status)}`}>{line.message}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
