import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Modal, Select, Space, Typography, message } from "antd";
import { apiGet, apiPostJson } from "@/api/client";
import type { ApiResult } from "@/api/types";
import type { AdminMovieListPayload, AdminMovieRow } from "@/types/adminMovie";
import type { AdminPoolType } from "@/types/adminPool";

type Props = {
  open: boolean;
  poolType: AdminPoolType;
  existingMovieIds: Set<number>;
  minSortHint: number;
  onClose: () => void;
  onAdded: () => void;
};

export function RecommendPoolAddModal({ open, poolType, existingMovieIds, minSortHint, onClose, onAdded }: Props) {
  const [searching, setSearching] = useState(false);
  const [options, setOptions] = useState<{ value: number; label: string }[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const searchTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      setSelectedIds([]);
      setOptions([]);
    }
  }, [open]);

  const searchMovies = useCallback(
    async (kw: string) => {
      const keyword = kw.trim();
      if (!keyword) {
        setOptions([]);
        return;
      }
      setSearching(true);
      try {
        const res: ApiResult<AdminMovieListPayload> = await apiGet<AdminMovieListPayload>("admin/movie/list", {
          page: 1,
          keyword,
          language: "all",
        });
        if (res.c !== 0) {
          message.error(res.m || "搜索失败");
          setOptions([]);
          return;
        }
        const list = Array.isArray(res.d?.data) ? res.d.data : [];
        const opts = list
          .filter((row: AdminMovieRow) => !existingMovieIds.has(row.id))
          .map((row: AdminMovieRow) => ({
            value: row.id,
            label: `${row.id} · ${String(row.title ?? "未命名")}`,
          }));
        setOptions(opts);
      } catch {
        message.error("网络异常");
        setOptions([]);
      } finally {
        setSearching(false);
      }
    },
    [existingMovieIds],
  );

  const onSearch = useCallback(
    (v: string) => {
      if (searchTimer.current) {
        window.clearTimeout(searchTimer.current);
      }
      searchTimer.current = window.setTimeout(() => void searchMovies(v), 400);
    },
    [searchMovies],
  );

  useEffect(
    () => () => {
      if (searchTimer.current) {
        window.clearTimeout(searchTimer.current);
      }
    },
    [],
  );

  async function handleConfirm() {
    if (selectedIds.length === 0) {
      return;
    }
    setSubmitting(true);
    let nextSort = minSortHint - 1;
    let ok = 0;
    try {
      for (const movieId of selectedIds) {
        const res: ApiResult<unknown> = await apiPostJson("admin/pools/add", {
          movie_id: movieId,
          sort: nextSort,
          type: poolType,
        });
        if (res.c !== 0) {
          message.error(res.m || `添加剧集 ${movieId} 失败`);
          break;
        }
        ok += 1;
        nextSort -= 1;
      }
      if (ok > 0) {
        message.success(`已添加 ${ok} 部推荐剧`);
        onAdded();
        onClose();
      }
    } catch {
      message.error("网络异常");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="添加推荐剧"
      open={open}
      onCancel={onClose}
      footer={
        <Space>
          <Button onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button
            type="primary"
            loading={submitting}
            disabled={selectedIds.length === 0}
            onClick={() => void handleConfirm()}
          >
            确认添加
          </Button>
        </Space>
      }
      destroyOnClose
      width={520}
    >
      <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
        输入剧名搜索，可多选；将加入推荐池并排在列表末尾。
      </Typography.Paragraph>
      <Typography.Text>
        选择剧集 <Typography.Text type="danger">*</Typography.Text>
      </Typography.Text>
      <Select
        mode="multiple"
        showSearch
        filterOption={false}
        placeholder="输入剧名搜索…"
        style={{ width: "100%", marginTop: 8 }}
        options={options}
        value={selectedIds}
        onChange={setSelectedIds}
        onSearch={onSearch}
        loading={searching}
        notFoundContent={searching ? "搜索中…" : "输入关键词搜索剧集"}
        maxTagCount="responsive"
      />
    </Modal>
  );
}
