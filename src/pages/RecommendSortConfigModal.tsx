import { useCallback, useEffect, useState } from "react";
import { Button, Input, Modal, Select, Spin, Typography, message } from "antd";
import { ArrowDownOutlined, ArrowUpOutlined } from "@ant-design/icons";
import { apiGet, apiPostJson } from "@/api/client";
import type { ApiResult } from "@/api/types";
import type { AdminForyouListPayload, ForyouPositionRow, ForyouPositionSrc } from "@/types/adminForyou";
import { DEFAULT_FORYOU_POSITION_DESC, FORYOU_SRC_OPTIONS } from "@/lib/foryouPositionDisplay";
import styles from "./RecommendSortConfigModal.module.css";

export type PositionDraft = {
  pos: number;
  src: ForyouPositionSrc;
  desc: string;
};

function normalizePositions(raw: ForyouPositionRow[] | undefined): PositionDraft[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: PositionDraft[] = [];
  for (let i = 0; i < 10; i += 1) {
    const item = list[i];
    const pos = i + 1;
    const src = (item?.src ?? "n") as ForyouPositionSrc;
    const apiDesc = item?.desc != null ? String(item.desc) : "";
    out.push({
      pos,
      src: FORYOU_SRC_OPTIONS.some((o) => o.value === src) ? src : "n",
      desc: apiDesc || (DEFAULT_FORYOU_POSITION_DESC[pos] ?? ""),
    });
  }
  return out;
}

function swapPositions(rows: PositionDraft[], index: number, dir: -1 | 1): PositionDraft[] {
  const j = index + dir;
  if (j < 0 || j >= rows.length) {
    return rows;
  }
  const next = [...rows];
  const tmp = next[index]!;
  next[index] = next[j]!;
  next[j] = tmp;
  return next.map((r, i) => ({ ...r, pos: i + 1 }));
}

type Props = {
  open: boolean;
  onClose: () => void;
};

export function RecommendSortConfigModal({ open, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [configId, setConfigId] = useState<number | null>(null);
  const [title, setTitle] = useState("For You");
  const [pageSize, setPageSize] = useState(10);
  const [positions, setPositions] = useState<PositionDraft[]>(() => normalizePositions([]));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res: ApiResult<AdminForyouListPayload> = await apiGet<AdminForyouListPayload>("admin/foryou");
      if (res.c !== 0) {
        message.error(res.m || "加载失败");
        return;
      }
      const list = Array.isArray(res.d?.data) ? res.d.data : [];
      const active = list.find((x) => x.is_active === 1) ?? list[0];
      if (!active) {
        setPositions(normalizePositions([]));
        setConfigId(null);
        return;
      }
      setConfigId(active.id);
      setTitle(String(active.title ?? "For You"));
      setPageSize(Number(active.page_size) || 10);
      setPositions(normalizePositions(active.positions));
    } catch {
      message.error("网络异常");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void load();
    }
  }, [open, load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res: ApiResult<unknown> = await apiPostJson("admin/foryou/save", {
        title,
        page_size: pageSize,
        positions: positions.map((p) => ({ src: p.src, desc: p.desc })),
      });
      if (res.c !== 0) {
        message.error(res.m || "保存失败");
        return;
      }
      if (configId != null) {
        const act: ApiResult<unknown> = await apiPostJson("admin/foryou/activate", { id: configId });
        if (act.c !== 0) {
          message.warning(act.m || "已保存，但激活失败");
        }
      }
      message.success("推荐排序配置已保存");
      onClose();
    } catch {
      message.error("网络异常");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={880}
      destroyOnHidden
      className={styles.modal}
      closable
      maskClosable={!saving}
    >
      <div className={styles.header}>
        <Typography.Title level={4} className={styles.title}>
          推荐排序配置
        </Typography.Title>
        <Typography.Paragraph type="secondary" className={styles.subtitle}>
          定义首屏卡片位置 1–10 的固定展示来源，编辑备注说明及调整位置顺序
        </Typography.Paragraph>
      </div>

      <div className={styles.body}>
        {loading ? (
          <div className={styles.loadingWrap}>
            <Spin />
          </div>
        ) : (
          <>
            <div className={styles.tableHead}>
              <span>位置</span>
              <span>内容来源</span>
              <span>说明（可编辑）</span>
              <span style={{ textAlign: "right" }}>操作</span>
            </div>
            {positions.map((row, index) => (
              <div key={row.pos} className={styles.row}>
                <span className={styles.posBadge}>{row.pos}</span>
                <Select
                  className={styles.srcSelect}
                  value={row.src}
                  options={FORYOU_SRC_OPTIONS}
                  onChange={(v: ForyouPositionSrc) => {
                    setPositions((prev) => prev.map((p, i) => (i === index ? { ...p, src: v } : p)));
                  }}
                />
                <Input
                  className={styles.descInput}
                  value={row.desc}
                  placeholder="填写该推广位的用途描述…"
                  onChange={(e) => {
                    const v = e.target.value;
                    setPositions((prev) => prev.map((p, i) => (i === index ? { ...p, desc: v } : p)));
                  }}
                />
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.moveBtn}
                    disabled={index === 0}
                    aria-label="上移"
                    onClick={() => setPositions((prev) => swapPositions(prev, index, -1))}
                  >
                    <ArrowUpOutlined />
                  </button>
                  <button
                    type="button"
                    className={styles.moveBtn}
                    disabled={index === positions.length - 1}
                    aria-label="下移"
                    onClick={() => setPositions((prev) => swapPositions(prev, index, 1))}
                  >
                    <ArrowDownOutlined />
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <div className={styles.footer}>
        <Button onClick={onClose} disabled={saving}>
          取消
        </Button>
        <Button type="primary" loading={saving} disabled={loading} onClick={() => void handleSave()}>
          保存配置
        </Button>
      </div>
    </Modal>
  );
}
