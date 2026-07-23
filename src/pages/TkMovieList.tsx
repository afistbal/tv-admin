import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Progress,
  Select,
  Spin,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { apiGet, apiPostJson } from "@/api/client";
import type { ApiResult } from "@/api/types";
import { useAppStaticBase } from "@/config/AppConfigContext";
import { formatDateTimeZh } from "@/lib/formatDateTime";
import { movieCoverUrl, staticAssetUrl } from "@/lib/staticAssetOrigin";
import { mainContentTableSticky } from "@/lib/tableSticky";
import type { AdminMovieDetailPayload, AdminMovieListPayload, AdminMovieRow } from "@/types/adminMovie";
import type {
  AdminTkMovieDetailPayload,
  AdminTkDictionaryItem,
  AdminTkMovieEpisodeRow,
  AdminTkMovieListPayload,
  AdminTkMovieRow,
  AdminTkMovieSavePayload,
} from "@/types/adminTkMovie";
import styles from "./TkMovieList.module.css";

// api client 的 baseURL 已包含 `/api/`。
const API_PREFIX = "admin/tk-movies";
const PAGE_SIZE = 24;
const CURRENT_YEAR = new Date().getFullYear();

const STATUS_OPTIONS = [
  { value: "all", label: "全部处理状态" },
  { value: "0", label: "待上传" },
  { value: "1", label: "上传任务已提交" },
  { value: "2", label: "待创建 Album" },
  { value: "3", label: "待审核" },
  { value: "4", label: "审核成功" },
  { value: "5", label: "审核失败" },
];

const PUBLISH_OPTIONS = [
  { value: "all", label: "全部上下架状态" },
  { value: "1", label: "已上架" },
  { value: "0", label: "已下架" },
];

const DRAMA_TYPE_ZH: Record<string, string> = {
  Romance: "爱情",
  Fantasy: "奇幻",
  Thriller: "惊悚",
  Comedy: "喜剧",
};

function tkErrorMessage(value: string | undefined, fallback: string): string {
  if (value === "tk_movie_cover_missing") {
    return "缺少 TikTok 封面，暂时无法创建 Album";
  }
  return value || fallback;
}

type CreateFormValues = {
  source_movie_id?: number;
  movie_id?: number;
  title?: string;
  language?: number;
  year?: number;
  description?: string;
  drama_type?: number;
  tag_list?: string;
};

function parseNumberList(value?: string): number[] | undefined {
  const values = String(value ?? "")
    .split(/[，,]/)
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);
  return values.length ? values : undefined;
}

function statusTag(status: number) {
  const map: Record<number, { color: string; label: string }> = {
    0: { color: "default", label: "待上传" },
    1: { color: "processing", label: "上传任务已提交" },
    2: { color: "cyan", label: "待创建 Album" },
    3: { color: "gold", label: "待审核" },
    4: { color: "success", label: "审核成功" },
    5: { color: "error", label: "审核失败" },
  };
  const item = map[Number(status)] ?? { color: "default", label: `未知（${status}）` };
  return <Tag color={item.color}>{item.label}</Tag>;
}

function canSetOnline(row: AdminTkMovieRow): boolean {
  return Boolean(
    row.tiktok_album_id &&
      Number(row.tiktok_version) > 0 &&
      [2, 6].includes(Number(row.tiktok_review_status)),
  );
}

function canPublish(row: AdminTkMovieRow): boolean {
  const total = Number(row.episode_count) || 0;
  const uploaded = Number(row.byteplus_episode_count) || 0;
  return Number(row.status) === 4 && canSetOnline(row) && total > 0 && uploaded >= total;
}

export function TkMovieList() {
  const staticBase = useAppStaticBase();
  const [form] = Form.useForm<CreateFormValues>();
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selfMovieRows, setSelfMovieRows] = useState<AdminMovieRow[]>([]);
  const [selfMovieTotal, setSelfMovieTotal] = useState(0);
  const [selfMoviePage, setSelfMoviePage] = useState(1);
  const [selfMovieKeyword, setSelfMovieKeyword] = useState("");
  const [selfMovieLoading, setSelfMovieLoading] = useState(false);
  const [movieDetailLoading, setMovieDetailLoading] = useState(false);
  const selfMovieSearchTimer = useRef<number | null>(null);
  const selfMovieRequestId = useRef(0);
  const selfMovieLoadingRef = useRef(false);
  const [rows, setRows] = useState<AdminTkMovieRow[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [nextPageUrl, setNextPageUrl] = useState<string | null>(null);
  const [prevPageUrl, setPrevPageUrl] = useState<string | null>(null);
  const [languageDictionary, setLanguageDictionary] = useState<AdminTkDictionaryItem[]>([]);
  const [dramaTypeDictionary, setDramaTypeDictionary] = useState<AdminTkDictionaryItem[]>([]);
  const [dictionaryLoading, setDictionaryLoading] = useState(false);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("all");
  const [publishStatus, setPublishStatus] = useState("all");
  const [language, setLanguage] = useState("en");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailRow, setDetailRow] = useState<AdminTkMovieRow | null>(null);
  const [detail, setDetail] = useState<AdminTkMovieDetailPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setDictionaryLoading(true);
    void Promise.all([
      apiGet<AdminTkDictionaryItem[]>(`${API_PREFIX}/languages`),
      apiGet<AdminTkDictionaryItem[]>(`${API_PREFIX}/drama-types`),
    ])
      .then(([languageRes, dramaTypeRes]) => {
        if (!active) return;
        if (languageRes.c === 0) {
          setLanguageDictionary(Array.isArray(languageRes.d) ? languageRes.d : []);
        } else {
          message.error(languageRes.m || "加载语言字典失败");
        }
        if (dramaTypeRes.c === 0) {
          setDramaTypeDictionary(Array.isArray(dramaTypeRes.d) ? dramaTypeRes.d : []);
        } else {
          message.error(dramaTypeRes.m || "加载剧集类型字典失败");
        }
      })
      .catch(() => {
        if (active) message.error("加载 TK 字典失败，请检查网络或接口配置");
      })
      .finally(() => {
        if (active) setDictionaryLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const languageCreateOptions = useMemo(
    () => languageDictionary.map((item) => ({ value: item.value, label: item.label })),
    [languageDictionary],
  );

  const languageFilterOptions = useMemo(
    () => languageDictionary.map((item) => ({ value: item.code, label: item.label })),
    [languageDictionary],
  );

  const dramaTypeOptions = useMemo(
    () => dramaTypeDictionary.map((item) => {
      const english = item.label || item.code;
      const chinese = DRAMA_TYPE_ZH[item.code] || DRAMA_TYPE_ZH[english];
      return { value: item.value, label: chinese ? `${chinese}（${english}）` : english };
    }),
    [dramaTypeDictionary],
  );

  const fetchList = useCallback(async (targetPage = page) => {
    setLoading(true);
    try {
      const res: ApiResult<AdminTkMovieListPayload> = await apiGet(`${API_PREFIX}/list`, {
        page: targetPage,
        pageSize,
        keyword,
        language,
        status: status === "all" ? undefined : Number(status),
        publish_status: publishStatus === "all" ? undefined : Number(publishStatus),
      });
      if (res.c !== 0) {
        message.error(tkErrorMessage(res.m, "加载 TK 剧集失败"));
        setRows([]);
        setNextPageUrl(null);
        setPrevPageUrl(null);
        return;
      }
      const data = Array.isArray(res.d?.data) ? res.d.data : [];
      const responsePage = Number(res.d?.page ?? res.d?.current_page) || targetPage;
      const responsePageSize = Number(res.d?.pageSize ?? res.d?.per_page) || PAGE_SIZE;
      setRows(data);
      setNextPageUrl(
        typeof res.d?.next_page_url === "string"
          ? res.d.next_page_url
          : data.length >= responsePageSize
            ? "page-size-fallback"
            : null,
      );
      setPrevPageUrl(
        typeof res.d?.prev_page_url === "string"
          ? res.d.prev_page_url
          : responsePage > 1
            ? "page-number-fallback"
            : null,
      );
      setPageSize(responsePageSize);
      setPage(responsePage);
    } catch {
      message.error("加载 TK 剧集失败，请检查网络或接口配置");
      setRows([]);
      setNextPageUrl(null);
      setPrevPageUrl(null);
    } finally {
      setLoading(false);
    }
  }, [keyword, language, page, pageSize, publishStatus, status]);

  useEffect(() => {
    void fetchList(page);
  }, [fetchList, page]);

  const fetchSelfMovieList = useCallback(async (targetPage: number, targetKeyword = "", append = false) => {
    if (append && selfMovieLoadingRef.current) {
      return;
    }
    const requestId = ++selfMovieRequestId.current;
    selfMovieLoadingRef.current = true;
    setSelfMovieLoading(true);
    try {
      const res: ApiResult<AdminMovieListPayload> = await apiGet("admin/movie/list", {
        page: targetPage,
        keyword: targetKeyword,
        language: "all",
        is_self: 1,
      });
      if (requestId !== selfMovieRequestId.current) {
        return;
      }
      if (res.c !== 0) {
        message.error(res.m || "加载自制剧失败");
        setSelfMovieRows([]);
        setSelfMovieTotal(0);
        return;
      }
      const nextRows = Array.isArray(res.d?.data) ? res.d.data : [];
      setSelfMovieRows((currentRows) => {
        if (!append) {
          return nextRows;
        }
        const rowMap = new Map(currentRows.map((row) => [row.id, row]));
        nextRows.forEach((row) => rowMap.set(row.id, row));
        return Array.from(rowMap.values());
      });
      setSelfMovieTotal(Number(res.d?.count) || 0);
      setSelfMoviePage(Number(res.d?.current_page) || targetPage);
    } catch {
      if (requestId !== selfMovieRequestId.current) {
        return;
      }
      message.error("加载自制剧失败，请检查网络或接口配置");
      if (!append) {
        setSelfMovieRows([]);
        setSelfMovieTotal(0);
      }
    } finally {
      if (requestId === selfMovieRequestId.current) {
        selfMovieLoadingRef.current = false;
        setSelfMovieLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!createOpen) {
      return;
    }
    setSelfMovieRows([]);
    setSelfMovieTotal(0);
    setSelfMoviePage(1);
    setSelfMovieKeyword("");
    void fetchSelfMovieList(1);
  }, [createOpen, fetchSelfMovieList]);

  useEffect(
    () => () => {
      if (selfMovieSearchTimer.current) {
        window.clearTimeout(selfMovieSearchTimer.current);
      }
    },
    [],
  );

  const handleSelfMovieSearch = useCallback((value: string) => {
    if (selfMovieSearchTimer.current) {
      window.clearTimeout(selfMovieSearchTimer.current);
    }
    selfMovieSearchTimer.current = window.setTimeout(() => {
      const keywordValue = value.trim();
      setSelfMovieKeyword(keywordValue);
      setSelfMovieRows([]);
      setSelfMovieTotal(0);
      setSelfMoviePage(1);
      void fetchSelfMovieList(1, keywordValue);
    }, 350);
  }, [fetchSelfMovieList]);

  const handleSelfMovieSelect = useCallback(async (movieId: number | undefined) => {
    if (movieId == null) {
      form.setFieldsValue({
        source_movie_id: undefined,
        movie_id: undefined,
        title: "",
        tag_list: "",
        description: "",
      });
      return;
    }
    const selectedRow = selfMovieRows.find((row) => row.id === movieId);
    form.setFieldsValue({ movie_id: movieId, title: selectedRow?.title ?? "" });
    setMovieDetailLoading(true);
    try {
      const res: ApiResult<AdminMovieDetailPayload> = await apiGet("admin/movie", { id: movieId });
      if (res.c !== 0) {
        message.error(res.m || "加载短剧详情失败");
        return;
      }
      const info = res.d?.info ?? {};
      form.setFieldsValue({
        movie_id: movieId,
        title: String(info["title"] ?? selectedRow?.title ?? ""),
        tag_list: Array.isArray(res.d?.tag) ? res.d.tag.join(",") : "",
        description: String(info["introduction"] ?? ""),
      });
    } catch {
      message.error("加载短剧详情失败，请检查网络或接口配置");
    } finally {
      setMovieDetailLoading(false);
    }
  }, [form, selfMovieRows]);

  const submitCreate = async (values: CreateFormValues) => {
    const payload: AdminTkMovieSavePayload = {
      movie_id: Number(values.movie_id),
      title: values.title?.trim() || undefined,
      language: values.language,
      year: values.year,
      description: values.description?.trim() || undefined,
      drama_type: values.drama_type,
      tag_list: parseNumberList(values.tag_list),
    };
    setCreating(true);
    try {
      const res: ApiResult<unknown> = await apiPostJson(`${API_PREFIX}/save`, payload);
      if (res.c !== 0) {
        message.error(tkErrorMessage(res.m, "创建失败"));
        return;
      }
      message.success("TK 剧集已创建");
      form.resetFields();
      setCreateOpen(false);
      setPage(1);
      await fetchList(1);
    } catch {
      message.error("创建失败，请检查网络或接口配置");
    } finally {
      setCreating(false);
    }
  };

  const runAction = useCallback(async (row: AdminTkMovieRow, path: string, data: Record<string, unknown>, success: string) => {
    setBusyId(row.id);
    try {
      const res: ApiResult<unknown> = await apiPostJson(`${API_PREFIX}/${path}`, data);
      if (res.c !== 0) {
        message.error(tkErrorMessage(res.m, "操作失败"));
        return;
      }
      message.success(success);
      await fetchList();
    } catch {
      message.error("操作失败，请检查网络或接口配置");
    } finally {
      setBusyId(null);
    }
  }, [fetchList]);

  const changePublishStatus = useCallback((row: AdminTkMovieRow, targetStatus: 1 | 2) => {
    Modal.confirm({
      title: targetStatus === 1 ? "确认上架 TK 剧集？" : "确认下架 TK 剧集？",
      content: row.title || `原剧集 ID：${row.movie_id}`,
      okText: targetStatus === 1 ? "上架" : "下架",
      cancelText: "取消",
      okButtonProps: targetStatus === 2 ? { danger: true } : undefined,
      onOk: () => runAction(row, "media/status", { movie_id: row.movie_id, status: targetStatus }, targetStatus === 1 ? "已上架" : "已下架"),
    });
  }, [runAction]);

  const openDetail = useCallback(async (row: AdminTkMovieRow) => {
    setDetailId(row.id);
    setDetailRow(row);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res: ApiResult<AdminTkMovieDetailPayload> = await apiGet(`${API_PREFIX}/detail`, { id: row.id });
      if (res.c !== 0) {
        message.error(res.m || "加载详情失败");
        return;
      }
      setDetail(res.d);
    } catch {
      message.error("加载详情失败，请检查网络或接口配置");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const columns = useMemo<ColumnsType<AdminTkMovieRow>>(() => [
    {
      title: "剧集",
      key: "movie",
      width: 230,
      render: (_, row) => {
        const cover = staticAssetUrl(row.image, staticBase);
        return (
          <div className={styles.movieCell}>
            {cover ? <img className={styles.cover} src={cover} alt="" /> : <div className={styles.coverPlaceholder}>暂无封面</div>}
            <div className={styles.movieMeta}>
              <div className={styles.movieTitle} title={row.title}>{row.title || "未命名 TK 剧集"}</div>
              <div className={styles.movieId}>原剧集 ID：{row.movie_id}</div>
            </div>
          </div>
        );
      },
    },
    { title: "处理状态", dataIndex: "status", width: 145, render: (value) => statusTag(Number(value)) },
    {
      title: "媒体进度（BytePlus）",
      key: "progress",
      width: 230,
      render: (_, row) => {
        const totalCount = Number(row.episode_count) || 0;
        const uploaded = Number(row.byteplus_episode_count) || 0;
        const percent = totalCount > 0 ? Math.min(100, Math.round((uploaded / totalCount) * 100)) : 0;
        return (
          <div className={styles.progressCell}>
            <Progress percent={percent} showInfo={false} size="small" status={Number(row.status) === 5 ? "exception" : "active"} />
            <span className={styles.progressText}>{uploaded} / {totalCount} 集</span>
          </div>
        );
      },
    },
    {
      title: "上下架",
      dataIndex: "publish_status",
      width: 95,
      render: (value) => Number(value) === 1 ? <Tag color="success">已上架</Tag> : <Tag>已下架</Tag>,
    },
    {
      title: "TikTok 媒体",
      key: "tiktok",
      width: 190,
      render: (_, row) => (
        <div>
          <div>版本：{Number(row.tiktok_version) || "—"}</div>
          <div className={styles.subtle} title={row.tiktok_album_id ?? undefined}>Album：{row.tiktok_album_id || "—"}</div>
          {row.audit_remark ? <div className={styles.subtle} title={row.audit_remark}>备注：{row.audit_remark}</div> : null}
        </div>
      ),
    },
    { title: "排序", dataIndex: "sort", width: 75, render: (value) => Number(value) || 0 },
    { title: "更新时间", dataIndex: "updated_at", width: 168, render: (value) => formatDateTimeZh(value) },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 250,
      render: (_, row) => {
        const busy = busyId === row.id;
        const isPublished = Number(row.publish_status) === 1;
        return (
          <div className={styles.actionCell}>
            <Button size="small" onClick={() => void openDetail(row)}>详情</Button>
            <Button
              size="small"
              disabled={!canSetOnline(row)}
              loading={busy}
              onClick={() => void runAction(row, "media/online", { movie_id: row.movie_id }, "线上版本已设置")}
            >
              设为线上版本
            </Button>
            {isPublished ? (
              <Button size="small" danger loading={busy} onClick={() => changePublishStatus(row, 2)}>下架</Button>
            ) : (
              <Button size="small" type="primary" disabled={!canPublish(row)} loading={busy} onClick={() => changePublishStatus(row, 1)}>上架</Button>
            )}
          </div>
        );
      },
    },
  ], [busyId, changePublishStatus, openDetail, runAction, staticBase]);

  const episodeColumns: ColumnsType<AdminTkMovieEpisodeRow> = [
    { title: "集数", dataIndex: "episode", width: 80 },
    { title: "别名", dataIndex: "alias_name", render: (value) => value || "—" },
    { title: "BytePlus Vid", dataIndex: "byteplus_vid", ellipsis: true, render: (value) => value || "—" },
    { title: "TikTok Episode ID", dataIndex: "tiktok_episode_id", ellipsis: true, render: (value) => value || "—" },
    { title: "VIP", dataIndex: "vip", width: 70, render: (value) => Number(value) === 1 ? "是" : "否" },
    { title: "解锁金币", dataIndex: "unlock_coins", width: 90, render: (value) => Number(value) || 0 },
  ];

  const detailMovie = detail?.tk_movie
    ? { ...(detailRow ?? {}), ...detail.tk_movie }
    : detailRow;
  const detailLanguage = languageDictionary.find((item) => item.value === Number(detailMovie?.tiktok_language));
  const detailDramaType = dramaTypeOptions.find((item) => item.value === Number(detailMovie?.tiktok_drama_type));

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>TK剧集列表</Typography.Title>
      <div className={styles.toolbar}>
        <Typography.Title level={5} style={{ margin: 0 }}>TK 剧集列表 <Typography.Text type="secondary">（第 {page} 页，本页 {rows.length} 部）</Typography.Text></Typography.Title>
        <div className={styles.toolbarRight}>
          <Select value={status} options={STATUS_OPTIONS} style={{ width: 165 }} onChange={(value) => { setStatus(value); setPage(1); }} />
          <Select value={publishStatus} options={PUBLISH_OPTIONS} style={{ width: 160 }} onChange={(value) => { setPublishStatus(value); setPage(1); }} />
          <Select loading={dictionaryLoading} value={language} options={languageFilterOptions} style={{ width: 150 }} onChange={(value) => { setLanguage(value); setPage(1); }} />
          <Input.Search
            allowClear
            value={keywordInput}
            placeholder="标题 / 原剧集 ID"
            style={{ width: 220 }}
            onChange={(event) => setKeywordInput(event.target.value)}
            onSearch={(value) => { setKeyword(value.trim()); setPage(1); }}
          />
          <Button onClick={() => void fetchList()}>刷新</Button>
          <Button type="primary" onClick={() => setCreateOpen(true)}>+ 新增 TK 剧集</Button>
        </div>
      </div>

      <Table<AdminTkMovieRow>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={false}
        sticky={mainContentTableSticky}
        tableLayout="fixed"
        scroll={{ x: 1383 }}
        locale={{ emptyText: loading ? "加载中…" : "暂无 TK 剧集" }}
      />
      <div className={styles.pagination}>
        <Button disabled={!prevPageUrl || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}>上一页</Button>
        <Typography.Text>第 {page} 页</Typography.Text>
        <Button disabled={!nextPageUrl || loading} onClick={() => setPage((current) => current + 1)}>下一页</Button>
      </div>

      <Modal
        title="新增 TK 剧集"
        open={createOpen}
        width={920}
        footer={null}
        destroyOnHidden
        maskClosable={!creating}
        closable={!creating}
        onCancel={() => {
          setCreateOpen(false);
          form.resetFields();
        }}
      >
        <Form form={form} layout="vertical" initialValues={{ year: CURRENT_YEAR }} onFinish={(values) => void submitCreate(values)}>
          <div className={styles.createGrid}>
            <Form.Item
              className={styles.span12}
              name="source_movie_id"
              label="选择自制剧"
              rules={[{ required: true, message: "请选择自制剧" }]}
            >
              <Select
                allowClear
                showSearch
                virtual={false}
                filterOption={false}
                loading={selfMovieLoading || movieDetailLoading}
                placeholder="搜索并选择自制剧（短剧名称 / ID）"
                onSearch={handleSelfMovieSearch}
                onPopupScroll={(event) => {
                  const popup = event.currentTarget;
                  const reachedBottom = popup.scrollTop + popup.clientHeight >= popup.scrollHeight - 24;
                  if (reachedBottom && !selfMovieLoadingRef.current && selfMovieRows.length < selfMovieTotal) {
                    void fetchSelfMovieList(selfMoviePage + 1, selfMovieKeyword, true);
                  }
                }}
                onChange={(value) => void handleSelfMovieSelect(value)}
                options={selfMovieRows.map((row) => ({ value: row.id, label: row.title || `短剧 ${row.id}` }))}
                optionRender={(option) => {
                  const movie = selfMovieRows.find((row) => row.id === Number(option.value));
                  const cover = movieCoverUrl(movie, staticBase);
                  if (!movie) return option.label;
                  return (
                    <div className={styles.selfMovieOption}>
                      {cover ? <img className={styles.selfMovieCover} src={cover} alt="" /> : <div className={styles.selfMovieCoverEmpty}>无封面</div>}
                      <div className={styles.selfMovieOptionInfo}>
                        <div className={styles.selfMovieOptionTitle}>{movie.id} · {movie.title || "未命名短剧"}</div>
                      </div>
                    </div>
                  );
                }}
                notFoundContent={selfMovieLoading ? <Spin size="small" /> : "暂无符合条件的自制剧"}
                popupRender={(menu) => (
                  <div>
                    {menu}
                    {selfMovieLoading && selfMovieRows.length > 0 ? (
                      <div className={styles.selfMovieLoading}><Spin size="small" /><span>加载更多…</span></div>
                    ) : null}
                  </div>
                )}
              />
            </Form.Item>
            <Form.Item className={styles.span6} name="movie_id" label="原剧集 ID" rules={[{ required: true, message: "请输入原剧集 ID" }]}>
              <InputNumber disabled min={1} precision={0} placeholder="选择短剧后自动带入" style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item className={styles.span6} name="title" label="TK 剧集标题">
              <Input maxLength={255} placeholder="请输入 TK 剧集标题" />
            </Form.Item>
            <Form.Item className={styles.span6} name="language" label="语言">
              <Select allowClear loading={dictionaryLoading} placeholder="请选择语言" options={languageCreateOptions} />
            </Form.Item>
            <Form.Item className={styles.span6} name="year" label="上线年份">
              <InputNumber min={1900} max={2100} precision={0} placeholder="例如：2026" style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item className={styles.span6} name="drama_type" label="剧集类型">
              <Select allowClear loading={dictionaryLoading} placeholder="请选择剧集类型" options={dramaTypeOptions} />
            </Form.Item>
            <Form.Item className={styles.span6} name="tag_list" label="标签 ID 列表">
              <Input maxLength={1000} placeholder="多个标签 ID 请用逗号分隔" />
            </Form.Item>
            <Form.Item className={styles.span12} name="description" label="剧集描述">
              <Input.TextArea showCount maxLength={2000} autoSize={{ minRows: 2, maxRows: 5 }} placeholder="请输入剧集描述，最多 2000 字" />
            </Form.Item>
            <div className={styles.submitCell}>
              <Button type="primary" htmlType="submit" loading={creating || movieDetailLoading}>保存并创建</Button>
            </div>
          </div>
        </Form>
      </Modal>

      <Modal
        title="TK 剧集详情"
        open={detailId != null}
        onCancel={() => {
          setDetailId(null);
          setDetailRow(null);
          setDetail(null);
        }}
        footer={null}
        width={980}
        destroyOnHidden
      >
        <Spin spinning={detailLoading} tip="正在加载详情…">
          {detailMovie ? (
            <Descriptions className={styles.detailMeta} bordered size="small" column={{ xs: 1, sm: 2, md: 3 }}>
              <Descriptions.Item label="TK ID">{detailMovie.id ?? "—"}</Descriptions.Item>
              <Descriptions.Item label="原剧集 ID">{detailMovie.movie_id ?? "—"}</Descriptions.Item>
              <Descriptions.Item label="处理状态">{statusTag(Number(detailMovie.status))}</Descriptions.Item>
              <Descriptions.Item label="TK 标题">{detailMovie.tiktok_title || detailMovie.title || "—"}</Descriptions.Item>
              <Descriptions.Item label="上下架">{Number(detailMovie.publish_status) === 1 ? <Tag color="success">已上架</Tag> : <Tag>已下架</Tag>}</Descriptions.Item>
              <Descriptions.Item label="媒体进度">{Number(detailMovie.byteplus_episode_count) || 0} / {Number(detailMovie.episode_count) || 0} 集</Descriptions.Item>
              <Descriptions.Item label="语言">{detailLanguage?.label || detailMovie.tiktok_language || "—"}</Descriptions.Item>
              <Descriptions.Item label="上线年份">{detailMovie.tiktok_year || "—"}</Descriptions.Item>
              <Descriptions.Item label="剧集类型">{detailDramaType?.label || detailMovie.tiktok_drama_type || "—"}</Descriptions.Item>
              <Descriptions.Item label="标签 ID" span={3}>{Array.isArray(detailMovie.tiktok_tag_list) && detailMovie.tiktok_tag_list.length ? detailMovie.tiktok_tag_list.join("、") : "—"}</Descriptions.Item>
              <Descriptions.Item label="TikTok Album">{detailMovie.tiktok_album_id || "—"}</Descriptions.Item>
              <Descriptions.Item label="TikTok 版本">{Number(detailMovie.tiktok_version) || "—"}</Descriptions.Item>
              <Descriptions.Item label="更新时间">{formatDateTimeZh(detailMovie.updated_at)}</Descriptions.Item>
              <Descriptions.Item label="审核备注" span={3}>{detailMovie.audit_remark || "—"}</Descriptions.Item>
              <Descriptions.Item label="剧集描述" span={3}>{detailMovie.tiktok_description || "—"}</Descriptions.Item>
            </Descriptions>
          ) : null}
          {detail ? (
            <>
            <Typography.Title level={5}>分集列表</Typography.Title>
            <Table<AdminTkMovieEpisodeRow> rowKey="id" size="small" columns={episodeColumns} dataSource={Array.isArray(detail.episodes) ? detail.episodes : []} pagination={false} scroll={{ x: 760, y: 420 }} />
            </>
          ) : !detailLoading ? <Typography.Text type="secondary">详情接口暂未返回分集数据</Typography.Text> : null}
        </Spin>
      </Modal>
    </div>
  );
}
