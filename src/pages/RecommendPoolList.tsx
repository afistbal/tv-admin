import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Image,
  Input,
  Modal,
  Pagination,
  Select,
  Space,
  Table,
  Tabs,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { apiGet, apiPostJson } from "@/api/client";
import type { ApiResult } from "@/api/types";
import type { AdminPoolListPayload, AdminPoolRow, AdminPoolType } from "@/types/adminPool";
import { ADMIN_POOL_TAB_ITEMS } from "@/types/adminPool";
import { useAppStaticBase } from "@/config/AppConfigContext";
import { moviePosterUrl } from "@/lib/staticAssetOrigin";
import {
  MOVIE_LEVEL_FILTER_OPTIONS,
  formatCompactCount,
  formatDateYmd,
  movieLevelFromRow,
  movieLevelTag,
  MoviePlayCountCell,
  readFavoriteCount,
  type MovieLevelFilter,
} from "@/lib/movieLevelDisplay";
import { mainContentTableSticky } from "@/lib/tableSticky";
import stylesToolbar from "./UserList.module.css";
import styles from "./MovieList.module.css";
import { MovieEditModal } from "./MovieEditModal";
import { RecommendPoolAddModal } from "./RecommendPoolAddModal";
import { RecommendPoolSortModal } from "./RecommendPoolSortModal";
import { RecommendSortConfigModal } from "./RecommendSortConfigModal";

const POOL_TAB_LABEL: Record<AdminPoolType, string> = {
  recommend: "推荐页",
  search_feed: "搜索页",
  membership: "会员页",
};

function poolMovieRecord(row: AdminPoolRow): Record<string, unknown> | undefined {
  return row.movie as Record<string, unknown> | undefined;
}

function rowMatchesKeyword(row: AdminPoolRow, kw: string): boolean {
  if (!kw) {
    return true;
  }
  const title = String(row.movie?.title ?? "").toLowerCase();
  const id = String(row.movie_id ?? row.movie?.id ?? "");
  return title.includes(kw) || id.includes(kw);
}

function rowMatchesLevel(row: AdminPoolRow, level: MovieLevelFilter): boolean {
  if (level === "all") {
    return true;
  }
  return movieLevelFromRow(poolMovieRecord(row)) === level;
}

function compareRows(a: AdminPoolRow, b: AdminPoolRow): number {
  return Number(b.sort) - Number(a.sort);
}

export function RecommendPoolList() {
  const appStatic = useAppStaticBase();
  const [poolType, setPoolType] = useState<AdminPoolType>("recommend");
  const [loading, setLoading] = useState(false);
  const [allRows, setAllRows] = useState<AdminPoolRow[]>([]);
  const [page, setPage] = useState(1);
  const [perPage] = useState(24);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [levelFilter, setLevelFilter] = useState<MovieLevelFilter>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [sortConfigOpen, setSortConfigOpen] = useState(false);
  const [sortEditRow, setSortEditRow] = useState<AdminPoolRow | null>(null);
  const [detailMovieId, setDetailMovieId] = useState<number | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const searchTimer = useRef<number | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res: ApiResult<AdminPoolListPayload> = await apiGet<AdminPoolListPayload>("admin/pools", {
        type: poolType,
        page: 1,
        pageSize: 200,
      });
      if (res.c !== 0) {
        message.error(res.m || "加载失败");
        setAllRows([]);
        return;
      }
      const d = res.d;
      const list = Array.isArray(d?.data) ? d.data : [];
      setAllRows(list);
      setPage(1);
    } catch {
      message.error("网络异常");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [poolType]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  useEffect(() => {
    setPage(1);
  }, [keyword, levelFilter]);

  const onKeywordChange = (v: string) => {
    setKeywordInput(v);
    if (searchTimer.current) {
      window.clearTimeout(searchTimer.current);
    }
    searchTimer.current = window.setTimeout(() => setKeyword(v.trim()), 400);
  };

  useEffect(
    () => () => {
      if (searchTimer.current) {
        window.clearTimeout(searchTimer.current);
      }
    },
    [],
  );

  const onTabChange = (key: string) => {
    setPoolType(key as AdminPoolType);
    setKeywordInput("");
    setKeyword("");
    setLevelFilter("all");
    setPage(1);
    setAddOpen(false);
    setSortConfigOpen(false);
    setSortEditRow(null);
  };

  const filteredRows = useMemo(() => {
    const kw = keyword.toLowerCase();
    return allRows
      .filter((r) => rowMatchesKeyword(r, kw) && rowMatchesLevel(r, levelFilter))
      .sort(compareRows);
  }, [allRows, keyword, levelFilter]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredRows.slice(start, start + perPage);
  }, [filteredRows, page, perPage]);

  const displayRows = useMemo(
    () =>
      pagedRows.map((row, index) => ({
        ...row,
        _displayRank: (page - 1) * perPage + index + 1,
      })),
    [pagedRows, page, perPage],
  );

  const existingMovieIds = useMemo(() => new Set(allRows.map((r) => r.movie_id)), [allRows]);

  const minSortHint = useMemo(() => {
    if (allRows.length === 0) {
      return 100;
    }
    return Math.min(...allRows.map((r) => Number(r.sort) || 0));
  }, [allRows]);

  const filteredTotal = filteredRows.length;

  const handleRemove = useCallback(
    (row: AdminPoolRow) => {
      const tabLabel = POOL_TAB_LABEL[poolType];
      Modal.confirm({
        title: `移出${tabLabel}推荐`,
        content: `确定将「${String(row.movie?.title ?? row.movie_id)}」从${tabLabel}推荐列表移除？`,
        okText: "删除",
        okType: "danger",
        cancelText: "取消",
        onOk: async () => {
          setRemovingId(row.id);
          try {
            const res: ApiResult<unknown> = await apiPostJson("admin/pools/remove", { id: String(row.id) });
            if (res.c !== 0) {
              message.error(res.m || "删除失败");
              return;
            }
            message.success("已移除");
            await fetchList();
          } catch {
            message.error("网络异常");
          } finally {
            setRemovingId(null);
          }
        },
      });
    },
    [fetchList, poolType],
  );

  const columns: ColumnsType<AdminPoolRow & { _displayRank?: number }> = useMemo(
    () => [
      {
        title: "排序",
        key: "rank",
        width: 72,
        align: "center",
        render: (_: unknown, row) => row._displayRank ?? "—",
      },
      {
        title: "封面",
        key: "poster",
        width: 88,
        render: (_: unknown, row) => {
          const poster = moviePosterUrl(row.movie?.image as string | undefined, appStatic);
          return poster ? (
            <Image src={poster} alt="" width={48} height={64} className={styles.thumbImg} preview={false} />
          ) : (
            <span className={styles.thumbPlaceholder}>—</span>
          );
        },
      },
      {
        title: "剧名",
        key: "title",
        minWidth: 200,
        render: (_: unknown, row) => {
          const title = String(row.movie?.title ?? "—");
          return (
            <Button type="link" style={{ padding: 0, height: "auto", textAlign: "left" }} onClick={() => setDetailMovieId(row.movie_id)}>
              <Typography.Text strong style={{ whiteSpace: "normal" }}>
                {title}
              </Typography.Text>
            </Button>
          );
        },
      },
      {
        title: "ID",
        dataIndex: "movie_id",
        key: "movie_id",
        width: 96,
      },
      {
        title: "级别",
        key: "level",
        width: 88,
        align: "center",
        render: (_: unknown, row) => movieLevelTag(movieLevelFromRow(poolMovieRecord(row))),
      },
      {
        title: "播放量",
        key: "views",
        width: 148,
        render: (_: unknown, row) => <MoviePlayCountCell row={poolMovieRecord(row)} />,
      },
      {
        title: "收藏数",
        key: "favorites",
        width: 100,
        align: "right",
        render: (_: unknown, row) => formatCompactCount(readFavoriteCount(poolMovieRecord(row))),
      },
      {
        title: "上架时间",
        key: "created_at",
        width: 120,
        render: (_: unknown, row) => formatDateYmd(row.created_at),
      },
      {
        title: "操作",
        key: "actions",
        width: 100,
        fixed: "right",
        render: (_: unknown, row) => (
          <Space size={4}>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              aria-label="编辑排序"
              onClick={() => setSortEditRow(row)}
            />
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              loading={removingId === row.id}
              aria-label="删除"
              onClick={() => handleRemove(row)}
            />
          </Space>
        ),
      },
    ],
    [appStatic, handleRemove, removingId],
  );

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        推荐管理
      </Typography.Title>

      <Tabs activeKey={poolType} onChange={onTabChange} items={ADMIN_POOL_TAB_ITEMS.map(({ key, label }) => ({ key, label }))} />

      <div className={stylesToolbar.toolbar} style={{ marginTop: 16 }}>
        <Space wrap className={stylesToolbar.toolbarLeft}>
          <Input
            allowClear
            placeholder="输入剧名搜索…"
            prefix={<span style={{ opacity: 0.45 }}>🔍</span>}
            value={keywordInput}
            onChange={(e) => onKeywordChange(e.target.value)}
            style={{ width: 260 }}
          />
          <Select
            value={levelFilter}
            style={{ width: 130 }}
            options={[...MOVIE_LEVEL_FILTER_OPTIONS]}
            onChange={(v) => setLevelFilter(v)}
          />
        </Space>
        <Space wrap className={stylesToolbar.toolbarRight}>
          {poolType === "recommend" ? (
            <Button onClick={() => setSortConfigOpen(true)}>推荐排序配置</Button>
          ) : null}
          <Button type="primary" onClick={() => setAddOpen(true)}>
            添加推荐剧
          </Button>
        </Space>
      </div>

      <Table
        rowKey={(r) => r.id}
        loading={loading}
        columns={columns}
        dataSource={displayRows}
        pagination={false}
        sticky={mainContentTableSticky}
        size="middle"
        tableLayout="fixed"
        locale={{ emptyText: loading ? "加载中…" : "暂无推荐剧" }}
        scroll={{ x: 1100 }}
      />

      <div className={stylesToolbar.paginationWrap}>
        <Pagination
          current={page}
          pageSize={perPage}
          total={filteredTotal}
          showSizeChanger={false}
          showTotal={() => `本页 ${displayRows.length} 条${keyword || levelFilter !== "all" ? "（已筛选）" : ""}`}
          onChange={(p) => setPage(p)}
          hideOnSinglePage
        />
      </div>

      <RecommendPoolAddModal
        open={addOpen}
        poolType={poolType}
        existingMovieIds={existingMovieIds}
        minSortHint={minSortHint}
        onClose={() => setAddOpen(false)}
        onAdded={() => void fetchList()}
      />

      <RecommendPoolSortModal
        row={sortEditRow}
        onClose={() => setSortEditRow(null)}
        onSaved={() => void fetchList()}
      />

      <RecommendSortConfigModal open={sortConfigOpen} onClose={() => setSortConfigOpen(false)} />

      {detailMovieId != null ? (
        <MovieEditModal
          key={detailMovieId}
          movieId={detailMovieId}
          staticBase={appStatic}
          onClose={() => setDetailMovieId(null)}
          onSaved={() => void fetchList()}
        />
      ) : null}
    </div>
  );
}
