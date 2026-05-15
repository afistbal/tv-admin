import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Dropdown, Image, Input, Modal, Pagination, Select, Space, Switch, Table, Tag, Tooltip, Typography, message } from "antd";
import type { MenuProps } from "antd";
import type { ColumnsType } from "antd/es/table";
import { apiGet, apiPostJson } from "@/api/client";
import type { ApiResult } from "@/api/types";
import type { AdminMovieListPayload, AdminMovieRow, AdminTagAreaRow } from "@/types/adminMovie";
import { useAppStaticBase } from "@/config/AppConfigContext";
import { moviePosterUrl } from "@/lib/staticAssetOrigin";
import { publicWebOrigin } from "@/lib/publicWebOrigin";
import stylesToolbar from "./UserList.module.css";
import styles from "./MovieList.module.css";
import { MovieEditModal } from "./MovieEditModal";

const LANGUAGES: { value: string; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "en", label: "英语" },
  { value: "zh", label: "繁体中文" },
  { value: "ja", label: "日语" },
  { value: "ko", label: "韩语" },
  { value: "pt", label: "葡萄牙语" },
  { value: "vi", label: "越南语" },
  { value: "th", label: "泰语" },
  { value: "tr", label: "土耳其语" },
  { value: "id", label: "印度尼西亚语" },
  { value: "de", label: "德语" },
  { value: "ms", label: "马来语" },
  { value: "ar", label: "阿拉伯语" },
];

/**
 * 与 slot_old 一致：**`sort === 100` = 在首页推荐**；**`sort === 0` = 非推荐**（取消推荐时接口传 0）。
 * 「推荐设为 0」指的是关推荐时把 `sort` 设为 0，不是用 0 表示「正在推荐」。
 */
function isRecommendRow(row: AdminMovieRow): boolean {
  return Number(row.sort) === 100;
}

/** `admin/movie/status` 与 slot MovieDetail 一致 */
function tagRowsFromApi(d: unknown): AdminTagAreaRow[] {
  const raw = Array.isArray(d)
    ? d
    : d != null && typeof d === "object" && "data" in d && Array.isArray((d as { data: unknown }).data)
      ? (d as { data: unknown[] }).data
      : [];
  const out: AdminTagAreaRow[] = [];
  for (const row of raw) {
    if (row == null || typeof row !== "object") {
      continue;
    }
    const o = row as Record<string, unknown>;
    const id = Number(o.id ?? o.ID);
    const name = String(o.name ?? o.title ?? "").trim();
    if (Number.isFinite(id) && name) {
      out.push({ id, name });
    }
  }
  return out;
}

function parseMovieTagIds(row: AdminMovieRow): number[] {
  const raw = row.tag ?? row["tags"];
  if (!Array.isArray(raw)) {
    return [];
  }
  const ids: number[] = [];
  for (const x of raw) {
    if (typeof x === "number" && Number.isFinite(x)) {
      ids.push(x);
    } else if (x != null && typeof x === "object" && "id" in x) {
      const n = Number((x as { id: unknown }).id);
      if (Number.isFinite(n)) {
        ids.push(n);
      }
    }
  }
  return ids;
}

function resolveMovieTagLabels(row: AdminMovieRow, idToName: Map<number, string>): string[] {
  const namesRaw = row["tag_names"];
  if (Array.isArray(namesRaw) && namesRaw.every((x) => typeof x === "string" || typeof x === "number")) {
    return namesRaw.map((x) => String(x).trim()).filter(Boolean);
  }
  const ids = parseMovieTagIds(row);
  return ids.map((id) => idToName.get(id) ?? `#${id}`);
}

function shelfStatusTag(status: unknown): ReactNode {
  const s = Number(status);
  if (s === 1) {
    return <Tag color="success">上架</Tag>;
  }
  if (s === 2) {
    return <Tag>下架</Tag>;
  }
  if (s === 3) {
    return <Tag color="error">已删除</Tag>;
  }
  return <Typography.Text type="secondary">—</Typography.Text>;
}

export function MovieList() {
  const [searchParams] = useSearchParams();
  const appStatic = useAppStaticBase();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AdminMovieRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(24);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [language, setLanguage] = useState("all");
  const [editId, setEditId] = useState<number | null>(null);
  const [recommendSavingId, setRecommendSavingId] = useState<number | null>(null);
  const [sortSavingId, setSortSavingId] = useState<number | null>(null);
  /** 操作列：导出 / 改状态 等 */
  const [rowActionBusyId, setRowActionBusyId] = useState<number | null>(null);
  const [tagNameById, setTagNameById] = useState<Map<number, string>>(() => new Map());
  const [posterPreviewUrl, setPosterPreviewUrl] = useState<string | null>(null);
  const searchTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiGet<unknown>("admin/tag");
        if (cancelled || res.c !== 0) {
          return;
        }
        const list = tagRowsFromApi(res.d);
        const m = new Map<number, string>();
        for (const t of list) {
          m.set(t.id, t.name);
        }
        setTagNameById(m);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchList = useCallback(async (p: number, kw: string, lang: string) => {
    setLoading(true);
    try {
      const res: ApiResult<AdminMovieListPayload> = await apiGet<AdminMovieListPayload>("admin/movie/list", {
        page: p,
        keyword: kw,
        language: lang,
      });
      if (res.c !== 0) {
        message.error(res.m || "加载失败");
        setRows([]);
        setTotal(0);
        return;
      }
      const d = res.d;
      setRows(Array.isArray(d.data) ? d.data : []);
      setTotal(Number(d.count) || 0);
      setPerPage(Number(d.per_page) || 24);
      setPage(Number(d.current_page) || p);
    } catch {
      message.error("网络异常");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchList(page, keyword, language);
  }, [page, keyword, language, fetchList]);

  /** 仪表盘播放排行等入口：`/drama/movies?id=` 预填搜索 */
  useEffect(() => {
    const id = searchParams.get("id")?.trim();
    if (!id) {
      return;
    }
    setKeywordInput(id);
    setKeyword(id);
    setPage(1);
  }, [searchParams]);

  const onKeywordChange = (v: string) => {
    setKeywordInput(v);
    if (searchTimer.current) {
      window.clearTimeout(searchTimer.current);
    }
    searchTimer.current = window.setTimeout(() => {
      setKeyword(v.trim());
      setPage(1);
    }, 400);
  };

  useEffect(
    () => () => {
      if (searchTimer.current) {
        window.clearTimeout(searchTimer.current);
      }
    },
    [],
  );

  const handleRecommendChange = useCallback(
    async (row: AdminMovieRow, checked: boolean) => {
      /** 开 = 上推荐位(100)，关 = 取消推荐(0)，与 `admin/movie/sort` / slot 行为一致 */
      const newSort = checked ? 100 : 0;
      setRecommendSavingId(row.id);
      try {
        const res: ApiResult<unknown> = await apiPostJson("admin/movie/sort", {
          id: row.id,
          sort: newSort,
        });
        if (res.c !== 0) {
          message.error(res.m || "更新失败");
          return;
        }
        await fetchList(page, keyword, language);
      } catch {
        message.error("网络异常");
      } finally {
        setRecommendSavingId(null);
      }
    },
    [fetchList, page, keyword, language],
  );

  const handleSortCommit = useCallback(
    async (row: AdminMovieRow, raw: string) => {
      const trimmed = raw.trim();
      if (trimmed === "") {
        message.warning("请输入排序数字");
        return;
      }
      const n = Number(trimmed);
      if (!Number.isFinite(n) || !Number.isInteger(n)) {
        message.warning("排序须为整数");
        return;
      }
      if (n === Number(row.sort)) {
        return;
      }
      setSortSavingId(row.id);
      try {
        const res: ApiResult<unknown> = await apiPostJson("admin/movie/sort", {
          id: row.id,
          sort: n,
        });
        if (res.c !== 0) {
          message.error(res.m || "更新失败");
          return;
        }
        await fetchList(page, keyword, language);
      } catch {
        message.error("网络异常");
      } finally {
        setSortSavingId(null);
      }
    },
    [fetchList, page, keyword, language],
  );

  const playMovieUrl = useCallback((id: number) => `${publicWebOrigin()}/video/${id}`, []);

  const handleExportMovie = useCallback(async (row: AdminMovieRow) => {
    setRowActionBusyId(row.id);
    try {
      const res: ApiResult<string> = await apiGet<string>("admin/movie/export", { id: row.id });
      if (res.c !== 0) {
        message.error(res.m || "导出失败");
        return;
      }
      const text = res.d != null ? String(res.d) : "";
      const url = URL.createObjectURL(new Blob([text], { type: "text/plain; charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${row.id}.txt`;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      message.success("已开始下载");
    } catch {
      message.error("网络异常");
    } finally {
      setRowActionBusyId(null);
    }
  }, []);

  const handleMovieStatus = useCallback(
    (row: AdminMovieRow, status: number, confirmTitle: string) => {
      Modal.confirm({
        title: confirmTitle,
        okText: "确定",
        cancelText: "取消",
        onOk: async () => {
          setRowActionBusyId(row.id);
          try {
            const res: ApiResult<unknown> = await apiPostJson("admin/movie/status", {
              id: row.id,
              status,
            });
            if (res.c !== 0) {
              message.error(res.m || "操作失败");
              return;
            }
            message.success("已更新");
            await fetchList(page, keyword, language);
          } catch {
            message.error("网络异常");
          } finally {
            setRowActionBusyId(null);
          }
        },
      });
    },
    [fetchList, page, keyword, language],
  );

  /** 与 slot_old `Movie.tsx` 长按菜单一致：`POST admin/movie/set-audio-track`，字段 `audio` */
  const handleSetAudioTrack = useCallback(
    async (row: AdminMovieRow, audio: "zh-Hans" | "en") => {
      setRowActionBusyId(row.id);
      try {
        const res: ApiResult<unknown> = await apiPostJson("admin/movie/set-audio-track", {
          id: row.id,
          audio,
        });
        if (res.c !== 0) {
          message.error(res.m || "设置失败");
          return;
        }
        message.success(audio === "en" ? "已设为英文音轨" : "已设为中文音轨");
        await fetchList(page, keyword, language);
      } catch {
        message.error("网络异常");
      } finally {
        setRowActionBusyId(null);
      }
    },
    [fetchList, page, keyword, language],
  );

  const openPosterPreview = useCallback(
    (row: AdminMovieRow) => {
      const url = moviePosterUrl(row.image as string | undefined, appStatic);
      if (!url) {
        message.warning("无封面或未配置静态资源");
        return;
      }
      setPosterPreviewUrl(url);
    },
    [appStatic],
  );

  const columns: ColumnsType<AdminMovieRow> = useMemo(
    () => [
      {
        title: "排序",
        dataIndex: "sort",
        key: "sort",
        width: 108,
        render: (_: unknown, row) => {
          const busy = sortSavingId === row.id || recommendSavingId === row.id;
          const v = row.sort;
          const initial = Number.isFinite(Number(v)) ? String(v) : "";
          return (
            <Input
              key={`sort-${row.id}-${initial}`}
              size="small"
              defaultValue={initial}
              disabled={busy}
              style={{ width: 88 }}
              inputMode="numeric"
              onBlur={(e) => void handleSortCommit(row, e.target.value)}
              onPressEnter={(e) => e.currentTarget.blur()}
            />
          );
        },
      },
      {
        title: "ID",
        dataIndex: "id",
        key: "id",
        width: 88,
        render: (id: unknown) => String(id ?? "—"),
      },
      {
        title: "短剧名称",
        key: "title",
        /** 不设固定 width，多余横向空间由本列吃掉，避免挤到「操作」列 */
        minWidth: 200,
        render: (_: unknown, row) => {
          const text = String(row.title ?? "—");
          return (
            <Typography.Paragraph
              className={styles.titleCell}
              ellipsis={{ rows: 2, tooltip: true }}
              style={{ marginBottom: 0 }}
            >
              {text}
            </Typography.Paragraph>
          );
        },
      },
      {
        title: "标签",
        key: "tags",
        width: 168,
        render: (_: unknown, row) => {
          const labels = resolveMovieTagLabels(row, tagNameById);
          if (labels.length === 0) {
            return <Typography.Text type="secondary">—</Typography.Text>;
          }
          const shown = labels.slice(0, 3);
          const hasMore = labels.length > 3;
          const fullText = labels.join("、");
          return (
            <Tooltip title={fullText} placement="topLeft">
              <div className={styles.tagCellRow}>
                {shown.map((name, i) => (
                  <Tag key={`${row.id}-t-${i}`} bordered={false} className={styles.tagChip} title={name}>
                    {name}
                  </Tag>
                ))}
                {hasMore ? <span className={styles.tagMore}>…</span> : null}
              </div>
            </Tooltip>
          );
        },
      },
      {
        title: "是否上架",
        dataIndex: "status",
        key: "status",
        width: 100,
        align: "center",
        render: (status: unknown, row) => shelfStatusTag(row.status ?? status),
      },
      {
        title: "是否推荐",
        key: "recommend",
        width: 110,
        render: (_: unknown, row) => (
          <Switch
            checked={isRecommendRow(row)}
            loading={recommendSavingId === row.id}
            onChange={(c) => void handleRecommendChange(row, c)}
          />
        ),
      },
      {
        title: "封面",
        key: "poster",
        width: 96,
        render: (_: unknown, row) => {
          const poster = moviePosterUrl(row.image as string | undefined, appStatic);
          return (
            <div
              className={`${styles.thumbCell}${poster ? ` ${styles.thumbClickable}` : ""}`}
              onClick={poster ? () => openPosterPreview(row) : undefined}
              onKeyDown={
                poster
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openPosterPreview(row);
                      }
                    }
                  : undefined
              }
              role={poster ? "button" : undefined}
              tabIndex={poster ? 0 : undefined}
            >
              {poster ? (
                <Image src={poster} alt="" width={56} height={75} className={styles.thumbImg} preview={false} />
              ) : (
                <span className={styles.thumbPlaceholder}>—</span>
              )}
            </div>
          );
        },
      },
      {
        title: "操作",
        key: "actions",
        width: 168,
        align: "left",
        fixed: "right",
        className: styles.opCol,
        render: (_: unknown, row) => {
          const busy = rowActionBusyId === row.id;
          const moreItems: MenuProps["items"] = [
            {
              key: "audioZh",
              label: "设为中文",
              disabled: busy,
              onClick: () => void handleSetAudioTrack(row, "zh-Hans"),
            },
            {
              key: "audioEn",
              label: "设为英文",
              disabled: busy,
              onClick: () => void handleSetAudioTrack(row, "en"),
            },
            { type: "divider" },
            {
              key: "status1",
              label: "上架",
              disabled: busy,
              onClick: () => handleMovieStatus(row, 1, "确定将该短剧上架？"),
            },
            {
              key: "status2",
              label: "下架",
              disabled: busy,
              onClick: () => handleMovieStatus(row, 2, "确定将该短剧下架？"),
            },
            {
              key: "status3",
              label: "删除",
              danger: true,
              disabled: busy,
              onClick: () => handleMovieStatus(row, 3, "确定删除该短剧？删除后不可恢复。"),
            },
          ];
          return (
            <div className={styles.actionsCell}>
              <Button type="link" size="small" className={styles.actionLink} disabled={busy} href={playMovieUrl(row.id)} target="_blank" rel="noreferrer">
                播放
              </Button>
              <Button type="link" size="small" className={styles.actionLink} disabled={busy} onClick={() => void handleExportMovie(row)}>
                导出
              </Button>
              <Button type="link" size="small" className={styles.actionLink} disabled={busy} onClick={() => setEditId(row.id)}>
                编辑
              </Button>
              <Dropdown menu={{ items: moreItems }} trigger={["click"]} disabled={busy}>
                <Button type="link" size="small" className={styles.actionLink}>
                  更多
                </Button>
              </Dropdown>
            </div>
          );
        },
      },
    ],
    [
      appStatic,
      recommendSavingId,
      sortSavingId,
      rowActionBusyId,
      handleRecommendChange,
      handleSortCommit,
      playMovieUrl,
      handleExportMovie,
      handleMovieStatus,
      handleSetAudioTrack,
      openPosterPreview,
      tagNameById,
    ],
  );

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        影片列表
      </Typography.Title>

      <div className={stylesToolbar.toolbar}>
        <Space wrap className={stylesToolbar.toolbarLeft}>
          <Typography.Text type="secondary">共 {total} 部</Typography.Text>
        </Space>
        <Space wrap className={stylesToolbar.toolbarRight}>
          <Select
            value={language}
            style={{ width: 140 }}
            onChange={(v) => {
              setLanguage(v);
              setPage(1);
            }}
            options={LANGUAGES}
          />
          <Input
            allowClear
            placeholder="🔍检索"
            value={keywordInput}
            onChange={(e) => onKeywordChange(e.target.value)}
            style={{ width: 220 }}
            maxLength={32}
          />
          <Button
            type="primary"
            onClick={() => {
              const kw = keywordInput.trim();
              setKeyword(kw);
              setPage(1);
              if (page === 1) {
                void fetchList(1, kw, language);
              }
            }}
          >
            搜索
          </Button>
        </Space>
      </div>

      <Table<AdminMovieRow>
        rowKey={(r) => r.id}
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={false}
        size="middle"
        tableLayout="fixed"
        locale={{ emptyText: loading ? "加载中…" : "暂无影片" }}
        /** 固定数值避免 `max-content` 把固定列撑出过宽留白；短剧名称用 `minWidth` 吃剩余宽度 */
        scroll={{ x: 1124 }}
      />

      <div className={stylesToolbar.paginationWrap}>
        <Pagination
          current={page}
          pageSize={perPage}
          total={total}
          showSizeChanger={false}
          showTotal={(t) => `共 ${t} 部`}
          onChange={(p) => setPage(p)}
        />
      </div>

      <Modal
        title={null}
        open={posterPreviewUrl != null}
        footer={null}
        closable={false}
        onCancel={() => setPosterPreviewUrl(null)}
        centered
        width="auto"
        destroyOnClose
        wrapClassName={styles.posterPreviewModalWrap}
        styles={{
          content: { padding: 0, margin: 0 },
          body: { padding: 0, margin: 0, lineHeight: 0, minHeight: 0 },
        }}
        maskClosable
      >
        {posterPreviewUrl ? (
          <div className={styles.posterPreviewWrap}>
            <button type="button" className={styles.posterPreviewCloseBtn} onClick={() => setPosterPreviewUrl(null)} aria-label="关闭">
              ✕
            </button>
            <img src={posterPreviewUrl} alt="" className={styles.posterPreviewImg} />
          </div>
        ) : null}
      </Modal>

      {editId != null ? (
        <MovieEditModal
          key={editId}
          movieId={editId}
          staticBase={appStatic}
          onClose={() => setEditId(null)}
          onSaved={() => void fetchList(page, keyword, language)}
        />
      ) : null}
    </div>
  );
}
