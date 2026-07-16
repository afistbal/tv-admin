import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Dropdown, Image, Input, Modal, Pagination, Select, Space, Switch, Table, Typography, message } from "antd";
import type { MenuProps } from "antd";
import type { ColumnsType } from "antd/es/table";
import { apiGet, apiPostJson } from "@/api/client";
import { downloadMovieExportTxt } from "@/lib/movieExport";
import type { ApiResult } from "@/api/types";
import type { AdminMovieDetailPayload, AdminMovieListPayload, AdminMovieRow } from "@/types/adminMovie";
import { useAppStaticBase } from "@/config/AppConfigContext";
import { checkImageUrlExists, movieCoverUrl, movieWatermarkCoverUrl, readMovieIsRename, readMovieIsSelf } from "@/lib/staticAssetOrigin";
import { publicWebOriginForVideo } from "@/lib/publicWebOrigin";
import {
  MOVIE_LEVEL_FILTER_OPTIONS,
  formatCompactCount,
  movieLevelFromRow,
  movieLevelTag,
  MoviePlayCountCell,
  readFavoriteCount,
  type MovieLevelFilter,
} from "@/lib/movieLevelDisplay";
import { mainContentTableSticky } from "@/lib/tableSticky";
import stylesToolbar from "./UserList.module.css";
import styles from "./MovieList.module.css";
import { BatchWatermarkModal } from "./BatchWatermarkModal";
import { CursorSaveModal } from "./CursorSaveModal";
import { MovieEditModal } from "./MovieEditModal";
import { PublishDramaModal } from "./PublishDramaModal";
import { isOriginalMovieSource } from "@/lib/dramaPublishApi";
import { buildMovieSavePayload } from "@/lib/movieSavePayload";

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

type MovieSourceFilter = "all" | "0" | "1";
type MovieStatusFilter = "all" | "0" | "1" | "2" | "3";
type MovieSelfFilter = "all" | "0" | "1";

const MOVIE_SOURCE_OPTIONS: { value: MovieSourceFilter; label: string }[] = [
  { value: "all", label: "全部来源" },
  { value: "0", label: "自动拉取" },
  { value: "1", label: "手动上传" },
];

const MOVIE_STATUS_OPTIONS: { value: MovieStatusFilter; label: string }[] = [
  { value: "all", label: "全部状态" },
  { value: "0", label: "草稿" },
  { value: "1", label: "已上架" },
  { value: "2", label: "已下架" },
  { value: "3", label: "已删除" },
];

const MOVIE_SELF_OPTIONS: { value: MovieSelfFilter; label: string }[] = [
  { value: "all", label: "是否自制" },
  { value: "1", label: "是" },
  { value: "0", label: "否" },
];

/**
 * 与 slot_old 一致：**`sort === 100` = 在首页推荐**；**`sort === 0` = 非推荐**（取消推荐时接口传 0）。
 * 「推荐设为 0」指的是关推荐时把 `sort` 设为 0，不是用 0 表示「正在推荐」。
 */
function isRecommendRow(row: AdminMovieRow): boolean {
  return Number(row.sort) === 100;
}

function movieStatusShortLabel(status: unknown): string {
  const s = Number(status);
  if (s === 0) {
    return "草稿";
  }
  if (s === 1) {
    return "上架";
  }
  if (s === 2) {
    return "下架";
  }
  if (s === 3) {
    return "已删除";
  }
  return "—";
}

function movieSourceShortLabel(source: unknown): string {
  return isOriginalMovieSource(source) ? "手动" : "自动";
}

/** `admin/movie/status` 与 slot MovieDetail 一致 */
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
  const [levelFilter, setLevelFilter] = useState<MovieLevelFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<MovieSourceFilter>("all");
  const [statusFilter, setStatusFilter] = useState<MovieStatusFilter>("all");
  const [selfFilter, setSelfFilter] = useState<MovieSelfFilter>("all");
  const [listOrderBy, setListOrderBy] = useState<"" | "play" | "favorite">("");
  const [editId, setEditId] = useState<number | null>(null);
  const [recommendSavingId, setRecommendSavingId] = useState<number | null>(null);
  const [watermarkSavingId, setWatermarkSavingId] = useState<number | null>(null);
  const [selfMadeSavingId, setSelfMadeSavingId] = useState<number | null>(null);
  const [sortSavingId, setSortSavingId] = useState<number | null>(null);
  /** 操作列：导出 / 改状态 等 */
  const [rowActionBusyId, setRowActionBusyId] = useState<number | null>(null);
  const [posterPreviewUrl, setPosterPreviewUrl] = useState<string | null>(null);
  const [batchWatermarkOpen, setBatchWatermarkOpen] = useState(false);
  const [publishDramaOpen, setPublishDramaOpen] = useState(false);
  const [publishEditId, setPublishEditId] = useState<number | null>(null);
  const [cursorSaveOpen, setCursorSaveOpen] = useState(false);
  const searchTimer = useRef<number | null>(null);

  const openMovieEdit = useCallback((row: AdminMovieRow) => {
    if (isOriginalMovieSource(row.source)) {
      setPublishEditId(row.id);
      return;
    }
    setEditId(row.id);
  }, []);

  const fetchList = useCallback(async (overridePage?: number) => {
    const p = overridePage ?? page;
    setLoading(true);
    try {
      const query: Record<string, string | number> = {
        page: p,
        keyword,
        language,
      };
      if (levelFilter !== "all") {
        query.level = levelFilter;
      }
      if (sourceFilter !== "all") {
        query.source = Number(sourceFilter);
      }
      if (statusFilter !== "all") {
        query.status = Number(statusFilter);
      }
      if (selfFilter !== "all") {
        query.is_self = Number(selfFilter);
      }
      if (listOrderBy) {
        query.order_by = listOrderBy;
      }
      const res: ApiResult<AdminMovieListPayload> = await apiGet<AdminMovieListPayload>("admin/movie/list", query);
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
  }, [page, keyword, language, levelFilter, sourceFilter, statusFilter, selfFilter, listOrderBy]);

  useEffect(() => {
    void fetchList();
  }, [page, keyword, language, levelFilter, sourceFilter, statusFilter, selfFilter, listOrderBy, fetchList]);

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
        await fetchList();
      } catch {
        message.error("网络异常");
      } finally {
        setRecommendSavingId(null);
      }
    },
    [fetchList, page, keyword, language, levelFilter, listOrderBy],
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
        await fetchList();
      } catch {
        message.error("网络异常");
      } finally {
        setSortSavingId(null);
      }
    },
    [fetchList, page, keyword, language, levelFilter, listOrderBy],
  );

  const playMovieUrl = useCallback((id: number) => `${publicWebOriginForVideo()}/video/${id}`, []);

  const handleExportMovie = useCallback(async (row: AdminMovieRow) => {
    setRowActionBusyId(row.id);
    try {
      await downloadMovieExportTxt(row.id);
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
            await fetchList();
          } catch {
            message.error("网络异常");
          } finally {
            setRowActionBusyId(null);
          }
        },
      });
    },
    [fetchList, page, keyword, language, levelFilter, listOrderBy],
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
        await fetchList();
      } catch {
        message.error("网络异常");
      } finally {
        setRowActionBusyId(null);
      }
    },
    [fetchList, page, keyword, language, levelFilter, listOrderBy],
  );

  const handleWatermarkChange = useCallback(
    async (row: AdminMovieRow, checked: boolean) => {
      const watermarkUrl = checked ? movieWatermarkCoverUrl(row.id, appStatic) : null;
      if (checked && !watermarkUrl) {
        message.warning("未配置静态资源，无法校验水印图");
        return;
      }

      setWatermarkSavingId(row.id);
      try {
        if (checked && watermarkUrl) {
          const exists = await checkImageUrlExists(watermarkUrl);
          if (!exists) {
            message.error(`水印图不存在：movie_images/${row.id}.webp，请先上传后再开启`);
            return;
          }
        }

        const res: ApiResult<unknown> = await apiPostJson("admin/language/save", {
          id: row.id,
          is_rename: checked ? 1 : 0,
        });
        if (res.c !== 0) {
          message.error(res.m || "操作失败");
          return;
        }
        message.success(checked ? "已开启水印" : "已关闭水印");
        await fetchList();
      } catch {
        message.error("网络异常");
      } finally {
        setWatermarkSavingId(null);
      }
    },
    [appStatic, fetchList, page, keyword, language, levelFilter, listOrderBy],
  );

  const handleSelfMadeChange = useCallback(
    async (row: AdminMovieRow, checked: boolean) => {
      setSelfMadeSavingId(row.id);
      try {
        const movieRes: ApiResult<AdminMovieDetailPayload> = await apiGet<AdminMovieDetailPayload>("admin/movie", {
          id: row.id,
        });
        if (movieRes.c !== 0) {
          message.error(movieRes.m || "加载失败");
          return;
        }
        const res: ApiResult<unknown> = await apiPostJson(
          "admin/movie/save",
          buildMovieSavePayload(row.id, movieRes.d, { is_self: checked ? 1 : 0 }),
        );
        if (res.c !== 0) {
          message.error(res.m || "操作失败");
          return;
        }
        message.success(checked ? "已开启自制" : "已关闭自制");
        await fetchList();
      } catch {
        message.error("网络异常");
      } finally {
        setSelfMadeSavingId(null);
      }
    },
    [fetchList],
  );

  const openPosterPreview = useCallback(
    (row: AdminMovieRow) => {
      const url = movieCoverUrl(row, appStatic);
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
          const alias = String(row.title_original ?? "").trim();
          return (
            <div className={styles.titleCellWrap}>
              <div className={styles.titleMainLine}>
              <span
                role="button"
                tabIndex={0}
                className={styles.titleLink}
                onClick={() => openMovieEdit(row)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openMovieEdit(row);
                  }
                }}
              >
                {text}
              </span>
              <Typography.Text className={styles.titleCopy} copyable={{ text }} />
              </div>
              <div className={styles.titleAliasLine}>
                <span className={styles.titleAliasLabel}>又名：</span>
                <span className={`${styles.titleAliasText} ${alias ? "" : styles.titleAliasEmpty}`}>
                  {alias || "-"}
                </span>
                {alias ? <Typography.Text className={styles.titleCopy} copyable={{ text: alias }} /> : null}
              </div>
            </div>
          );
        },
      },
      {
        title: "上架时间",
        key: "level",
        width: 108,
        align: "center",
        render: (_: unknown, row) => (
          <div className={styles.shelfTimeCell}>
            <div className={styles.shelfTimeLine}>
              {movieLevelTag(movieLevelFromRow(row as Record<string, unknown>))}
            </div>
            <div className={styles.shelfTimeSub}>{movieStatusShortLabel(row.status)}</div>
            <div className={styles.shelfTimeSub}>来源：{movieSourceShortLabel(row.source)}</div>
          </div>
        ),
      },
      {
        title: "播放量",
        key: "views",
        width: 132,
        render: (_: unknown, row) => <MoviePlayCountCell row={row as Record<string, unknown>} />,
      },
      {
        title: "收藏数",
        key: "favorites",
        width: 96,
        align: "right",
        render: (_: unknown, row) => formatCompactCount(readFavoriteCount(row as Record<string, unknown>)),
      },
      {
        title: "开关",
        key: "switches",
        width: 132,
        render: (_: unknown, row) => (
          <div className={styles.switchCell}>
            <Switch
              checked={isRecommendRow(row)}
              checkedChildren="开启推荐"
              unCheckedChildren="取消推荐"
              loading={recommendSavingId === row.id}
              onChange={(c) => void handleRecommendChange(row, c)}
            />
            <Switch
              checked={readMovieIsRename(row as Record<string, unknown>)}
              checkedChildren="开启水印"
              unCheckedChildren="关闭水印"
              loading={watermarkSavingId === row.id}
              onChange={(c) => void handleWatermarkChange(row, c)}
            />
            <Switch
              checked={readMovieIsSelf(row as Record<string, unknown>)}
              checkedChildren="开启自制"
              unCheckedChildren="关闭自制"
              loading={selfMadeSavingId === row.id}
              onChange={(c) => void handleSelfMadeChange(row, c)}
            />
          </div>
        ),
      },
      {
        title: "封面",
        key: "poster",
        width: 96,
        render: (_: unknown, row) => {
          const poster = movieCoverUrl(row, appStatic);
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
        width: 96,
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
              <div className={styles.actionsRow}>
                <Button
                  type="link"
                  size="small"
                  className={styles.actionLink}
                  disabled={busy}
                  href={playMovieUrl(row.id)}
                  target="_blank"
                  rel="noreferrer"
                >
                  播放
                </Button>
                <Button
                  type="link"
                  size="small"
                  className={styles.actionLink}
                  disabled={busy}
                  onClick={() => void handleExportMovie(row)}
                >
                  导出
                </Button>
                <Button
                  type="link"
                  size="small"
                  className={styles.actionLink}
                  disabled={busy}
                  onClick={() => openMovieEdit(row)}
                >
                  编辑
                </Button>
              </div>
              <div className={styles.actionsRow}>
                <Dropdown menu={{ items: moreItems }} trigger={["click"]} disabled={busy}>
                  <Button type="link" size="small" className={styles.actionLink}>
                    更多
                  </Button>
                </Dropdown>
              </div>
            </div>
          );
        },
      },
    ],
    [
      appStatic,
      recommendSavingId,
      watermarkSavingId,
      selfMadeSavingId,
      sortSavingId,
      rowActionBusyId,
      handleRecommendChange,
      handleWatermarkChange,
      handleSelfMadeChange,
      handleSortCommit,
      playMovieUrl,
      handleExportMovie,
      handleMovieStatus,
      handleSetAudioTrack,
      openMovieEdit,
      openPosterPreview,
    ],
  );

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        剧集列表
      </Typography.Title>

      <div className={stylesToolbar.toolbar}>
        <Space wrap className={stylesToolbar.toolbarLeft}>
          <Typography.Text type="secondary">共 {total} 部</Typography.Text>
        </Space>
        <Space wrap className={stylesToolbar.toolbarRight}>
          <Select
            value={sourceFilter}
            style={{ width: 130 }}
            options={MOVIE_SOURCE_OPTIONS}
            onChange={(v) => {
              setSourceFilter(v);
              setPage(1);
            }}
          />
          <Select
            value={statusFilter}
            style={{ width: 130 }}
            options={MOVIE_STATUS_OPTIONS}
            onChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
          />
          <Select
            value={selfFilter}
            style={{ width: 130 }}
            options={MOVIE_SELF_OPTIONS}
            onChange={(v) => {
              setSelfFilter(v);
              setPage(1);
            }}
          />
          <Select
            value={language}
            style={{ width: 140 }}
            onChange={(v) => {
              setLanguage(v);
              setPage(1);
            }}
            options={LANGUAGES}
          />
          <Select
            value={levelFilter}
            style={{ width: 150 }}
            options={[...MOVIE_LEVEL_FILTER_OPTIONS]}
            onChange={(v) => {
              setLevelFilter(v);
              setPage(1);
            }}
          />
          <Select
            value={listOrderBy || "default"}
            style={{ width: 160 }}
            onChange={(v) => {
              setListOrderBy(v === "default" ? "" : (v as "play" | "favorite"));
              setPage(1);
            }}
            options={[
              { value: "default", label: "默认排序" },
              { value: "play", label: "按播放量" },
              { value: "favorite", label: "按收藏数" },
            ]}
          />
          <Input
            allowClear
            placeholder="按剧名 / 又名 / ID 搜索"
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
                void fetchList(1);
              }
            }}
          >
            搜索
          </Button>
          <Button onClick={() => setBatchWatermarkOpen(true)}>批量切换水印</Button>
          <Button type="primary" onClick={() => setPublishDramaOpen(true)}>
            + 新增短剧
          </Button>
          <Button onClick={() => setCursorSaveOpen(true)}>重拉剧游标</Button>
        </Space>
      </div>

      <Table<AdminMovieRow>
        rowKey={(r) => r.id}
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={false}
        sticky={mainContentTableSticky}
        size="middle"
        tableLayout="fixed"
        locale={{ emptyText: loading ? "加载中…" : "暂无剧集" }}
        scroll={{ x: 1056 }}
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
        destroyOnHidden
        wrapClassName={styles.posterPreviewModalWrap}
        styles={{
          content: { padding: 0, margin: 0 },
          body: { padding: 0, margin: 0, minHeight: 0 },
        }}
        maskClosable
      >
        {posterPreviewUrl ? (
          <div className={styles.posterPreviewWrap}>
            <button type="button" className={styles.posterPreviewCloseBtn} onClick={() => setPosterPreviewUrl(null)} aria-label="关闭">
              ✕
            </button>
            <img src={posterPreviewUrl} alt="" className={styles.posterPreviewImg} />
            <div className={styles.posterPreviewUrlBar}>
              <a className={styles.posterPreviewUrlLink} href={posterPreviewUrl} target="_blank" rel="noreferrer">
                {posterPreviewUrl}
              </a>
              <Typography.Text className={styles.posterPreviewUrlCopy} copyable={{ text: posterPreviewUrl }} />
            </div>
          </div>
        ) : null}
      </Modal>

      <CursorSaveModal open={cursorSaveOpen} onClose={() => setCursorSaveOpen(false)} />

      <PublishDramaModal
        open={publishDramaOpen || publishEditId != null}
        movieId={publishEditId}
        staticBase={appStatic}
        onClose={() => {
          setPublishDramaOpen(false);
          setPublishEditId(null);
        }}
        onPublished={() => void fetchList()}
      />

      <BatchWatermarkModal
        open={batchWatermarkOpen}
        staticBase={appStatic}
        onClose={() => setBatchWatermarkOpen(false)}
        onCompleted={() => void fetchList()}
      />

      {editId != null ? (
        <MovieEditModal
          key={editId}
          movieId={editId}
          staticBase={appStatic}
          onClose={() => setEditId(null)}
          onSaved={() => void fetchList()}
        />
      ) : null}
    </div>
  );
}
