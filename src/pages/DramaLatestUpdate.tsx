import { DownloadOutlined } from "@ant-design/icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Image, Input, Space, Table, Tooltip, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useAuth } from "@/auth/AuthContext";
import { isAdminUser } from "@/auth/userInfo";
import { useAppStaticBase } from "@/config/AppConfigContext";
import { LATEST_UPDATE_LIST_DEFAULT_PER_PAGE, fetchLatestUpdateList } from "@/lib/dramaLatestUpdateApi";
import { downloadMovieExportTxt } from "@/lib/movieExport";
import { mainContentTableSticky } from "@/lib/tableSticky";
import { DramaLatestUpdateDetailModal } from "./DramaLatestUpdateDetailModal";
import styles from "./DramaLatestUpdate.module.css";

const COS_FALLBACK_BASE = "https://cos.yogoshort.com";

function pad(num: number) {
  return String(num).padStart(2, "0");
}

function formatDisplayTime(raw: string) {
  const value = String(raw ?? "").trim();
  if (!value) {
    return "—";
  }
  const normalized = value
    .replace("T", " ")
    .replace(/(\.\d+)?Z$/i, "")
    .trim();
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return normalized;
}

type TRow = Record<string, unknown>;

function pickText(row: TRow, keys: string[], fallback = "—") {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value);
    }
  }
  return fallback;
}

function rowTitle(row: TRow): string {
  return pickText(row, ["titile", "title", "name", "book_title"], "");
}

function joinUrl(base: string, path: string) {
  if (!path) {
    return "";
  }
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  if (path.startsWith("//")) {
    return `https:${path}`;
  }
  const root = base || COS_FALLBACK_BASE;
  const normalizedRoot = root.startsWith("//") ? `https:${root}` : root;
  const b = normalizedRoot.endsWith("/") ? normalizedRoot.slice(0, -1) : normalizedRoot;
  const p = path.startsWith("/") ? path.slice(1) : path;
  return `${b}/${p}`;
}

function imageBasename(path: string): string {
  const s = String(path ?? "").replace(/\\/g, "/").trim();
  if (!s) {
    return "";
  }
  const i = s.lastIndexOf("/");
  return i >= 0 ? s.slice(i + 1) : s;
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const safeName = filename.replace(/[/\\?%*:|"<>]/g, "_");
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = safeName;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  requestAnimationFrame(() => {
    a.remove();
    URL.revokeObjectURL(objectUrl);
  });
}

async function downloadImageViaCanvas(imageUrl: string, filename: string): Promise<boolean> {
  const safeName = filename.replace(/[/\\?%*:|"<>]/g, "_");
  return new Promise((resolve) => {
    const img = document.createElement("img");
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (!w || !h) {
          resolve(false);
          return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(false);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const lower = safeName.toLowerCase();
        const mime = lower.endsWith(".png")
          ? "image/png"
          : lower.endsWith(".jpg") || lower.endsWith(".jpeg")
            ? "image/jpeg"
            : "image/webp";
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(false);
              return;
            }
            triggerBlobDownload(blob, safeName);
            resolve(true);
          },
          mime,
          0.92,
        );
      } catch {
        resolve(false);
      }
    };
    img.onerror = () => resolve(false);
    img.src = imageUrl;
  });
}

async function downloadImageAsFile(url: string, filename: string) {
  const safeName = filename.replace(/[/\\?%*:|"<>]/g, "_");

  try {
    const res = await fetch(url, { mode: "cors", credentials: "omit", cache: "no-store" });
    if (res.ok) {
      const blob = await res.blob();
      if (blob && blob.size > 0) {
        triggerBlobDownload(blob, safeName);
        message.success("已开始下载");
        return;
      }
    }
  } catch {
    /* 继续尝试 canvas */
  }

  if (await downloadImageViaCanvas(url, safeName)) {
    message.success("已开始下载");
    return;
  }

  message.error("无法直接保存到本地（跨域限制）。请在大图预览里右键「图片另存为」，或由静态资源域名开放 CORS。");
}

type DramaListRow = {
  key: string;
  movieId: number;
  title: string;
  coverUrl: string;
  coverImageFile: string;
  time: string;
};

function movieIdFromRow(row: TRow): number | null {
  const n = Number(row.id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function buildDramaListRows(movies: TRow[], staticBase: string): DramaListRow[] {
  return movies.flatMap((row) => {
    const movieId = movieIdFromRow(row);
    if (movieId == null) {
      return [];
    }
    const title = rowTitle(row) || "—";
    const outerTime = pickText(
      row,
      ["updated_at", "update_time", "time", "created_at", "publish_time", "publish_at"],
      "",
    );
    const coverPath = pickText(row, ["image", "poster", "cover", "thumb", "cover_image"], "");
    return [
      {
        key: String(movieId),
        movieId,
        title,
        coverUrl: coverPath ? joinUrl(staticBase, coverPath) : "",
        coverImageFile: coverPath ? imageBasename(coverPath) : "",
        time: formatDisplayTime(outerTime || "—"),
      },
    ];
  });
}

export function DramaLatestUpdate() {
  const staticBase = useAppStaticBase() ?? "";
  const { user } = useAuth();
  const isAdmin = user != null && isAdminUser(user);

  const [titleKeyword, setTitleKeyword] = useState("");
  const [appliedTitle, setAppliedTitle] = useState("");
  const [apiList, setApiList] = useState<TRow[]>([]);
  const [total, setTotal] = useState(0);
  const [listPerPage, setListPerPage] = useState(LATEST_UPDATE_LIST_DEFAULT_PER_PAGE);
  const [serverPage, setServerPage] = useState(1);
  const [loadingList, setLoadingList] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);
  const [detailMovieId, setDetailMovieId] = useState<number | null>(null);
  const [detailMovieTitle, setDetailMovieTitle] = useState("");
  const [exportingId, setExportingId] = useState<number | null>(null);

  const fetchPage = useCallback(async (page: number): Promise<boolean> => {
    setLoadingList(true);
    try {
      const res = await fetchLatestUpdateList(page);
      if (res.c !== 0) {
        message.error(res.m || "加载失败");
        setApiList([]);
        setTotal(0);
        setHasFetched(false);
        return false;
      }
      const d = res.d;
      const data = Array.isArray(d?.data) ? d.data : [];
      setApiList(data);
      setTotal(Number(d?.count) || data.length);
      setListPerPage(Number(d?.per_page) || LATEST_UPDATE_LIST_DEFAULT_PER_PAGE);
      setServerPage(Number(d?.current_page) || page);
      setHasFetched(true);
      return true;
    } catch {
      message.error("网络异常");
      setApiList([]);
      setTotal(0);
      setHasFetched(false);
      return false;
    } finally {
      setLoadingList(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    const ok = await fetchPage(serverPage);
    if (ok) {
      setAppliedTitle(titleKeyword.trim());
    }
  }, [fetchPage, serverPage, titleKeyword]);

  useEffect(() => {
    void fetchPage(serverPage);
  }, [fetchPage, serverPage]);

  const handleFilterTitle = useCallback(() => {
    if (!hasFetched) {
      message.warning("请先点击「更新列表」拉取数据");
      return;
    }
    setAppliedTitle(titleKeyword.trim());
  }, [hasFetched, titleKeyword]);

  const filteredApiList = useMemo(() => {
    const kw = appliedTitle.trim().toLowerCase();
    if (!kw) {
      return apiList;
    }
    return apiList.filter((row) => rowTitle(row).toLowerCase().includes(kw));
  }, [apiList, appliedTitle]);

  const listRows = useMemo(() => buildDramaListRows(filteredApiList, staticBase), [filteredApiList, staticBase]);

  const serverTotalPage = Math.max(1, Math.ceil(total / listPerPage));

  const openDetail = useCallback((row: DramaListRow) => {
    setDetailMovieId(row.movieId);
    setDetailMovieTitle(row.title);
  }, []);

  const handleExport = useCallback(async (movieId: number) => {
    setExportingId(movieId);
    try {
      await downloadMovieExportTxt(movieId);
    } finally {
      setExportingId(null);
    }
  }, []);

  const columns: ColumnsType<DramaListRow> = useMemo(
    () => [
      {
        title: "名称",
        dataIndex: "title",
        key: "title",
        className: styles.titleColumn,
        ellipsis: true,
        width: 240,
        render: (title: string) => (
          <Typography.Text ellipsis={{ tooltip: title }} copyable={title && title !== "—" ? { text: title } : false}>
            {title}
          </Typography.Text>
        ),
      },
      {
        title: "封面",
        key: "cover",
        width: 140,
        align: "center",
        render: (_: unknown, record: DramaListRow) => {
          const url = record.coverUrl?.trim();
          const canDownload = Boolean(url && record.coverImageFile);
          const downloadFilename = canDownload ? `${record.movieId}_${record.coverImageFile}` : "";

          if (!url) {
            return (
              <div className={styles.coverCell}>
                <Typography.Text type="secondary" className={styles.coverIdLine}>
                  id: {record.movieId}
                </Typography.Text>
                <Typography.Text type="secondary">—</Typography.Text>
              </div>
            );
          }

          return (
            <div className={styles.coverCell}>
              <div className={styles.coverMeta}>
                <Typography.Text type="secondary" className={styles.coverIdLine}>
                  id: {record.movieId}
                </Typography.Text>
                <Tooltip title={canDownload ? `下载封面 ${downloadFilename}` : "无封面文件名"}>
                  <Button
                    type="text"
                    size="small"
                    className={styles.coverDownloadBtn}
                    icon={<DownloadOutlined />}
                    aria-label="下载封面"
                    disabled={!canDownload}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (canDownload && url) {
                        void downloadImageAsFile(url, downloadFilename);
                      }
                    }}
                  />
                </Tooltip>
              </div>
              <Image
                src={url}
                alt=""
                width={96}
                height={128}
                className={styles.coverThumb}
                preview={{ mask: "预览" }}
              />
            </div>
          );
        },
      },
      {
        title: "更新时间",
        dataIndex: "time",
        key: "time",
        width: 160,
      },
      {
        title: "操作",
        key: "actions",
        width: 120,
        fixed: "right",
        render: (_: unknown, record: DramaListRow) => {
          const busy = exportingId === record.movieId;
          return (
            <div className={styles.actionsCell}>
              <Button type="link" size="small" className={styles.actionLink} onClick={() => openDetail(record)}>
                详情
              </Button>
              <Button
                type="link"
                size="small"
                className={styles.actionLink}
                loading={busy}
                disabled={busy}
                onClick={() => void handleExport(record.movieId)}
              >
                导出
              </Button>
            </div>
          );
        },
      },
    ],
    [openDetail, handleExport, exportingId],
  );

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <Typography.Title level={4} className={styles.pageTitle}>
            最新更新
          </Typography.Title>
          <p className={styles.pageHint}>近 7 日更新剧目；详情查看集数，导出与剧集列表相同（下载 txt）。</p>
        </div>
        <Typography.Text type="secondary">共 {total} 部</Typography.Text>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.toolbarItem}>
          <Button type="primary" loading={loadingList} onClick={() => void handleRefresh()}>
            更新列表
          </Button>
        </div>
        <div className={styles.toolbarItem}>
          <span className={styles.toolbarLabel}>剧名</span>
          <Input
            allowClear
            placeholder={hasFetched ? "模糊搜索" : "请先更新列表"}
            disabled={!hasFetched}
            value={titleKeyword}
            onChange={(e) => setTitleKeyword(e.target.value)}
            onPressEnter={() => handleFilterTitle()}
            style={{ width: 200 }}
            maxLength={128}
          />
          <Button disabled={!hasFetched || loadingList} onClick={handleFilterTitle}>
            查询
          </Button>
        </div>
      </div>

      <div className={styles.tableScroll}>
        <Table<DramaListRow>
          rowKey="key"
          loading={loadingList}
          columns={columns}
          dataSource={listRows}
          pagination={false}
          sticky={mainContentTableSticky}
          size="middle"
          tableLayout="fixed"
          scroll={{ x: 720 }}
          locale={{
            emptyText: loadingList ? "加载中…" : hasFetched ? "暂无数据" : "请点击「更新列表」",
          }}
        />
      </div>

      <div className={styles.footer}>
        <div className={styles.footerStat}>
          匹配 {listRows.length} 部
          {appliedTitle ? "（已筛选）" : ""}
        </div>
        <Space className={styles.footerPager} wrap>
          <Button disabled={serverPage <= 1 || loadingList} onClick={() => setServerPage((p) => p - 1)}>
            上一页
          </Button>
          <Typography.Text>
            第 {serverPage} / {serverTotalPage} 页
          </Typography.Text>
          <Button disabled={serverPage >= serverTotalPage || loadingList} onClick={() => setServerPage((p) => p + 1)}>
            下一页
          </Button>
        </Space>
      </div>

      <DramaLatestUpdateDetailModal
        open={detailMovieId != null}
        movieId={detailMovieId}
        movieTitle={detailMovieTitle}
        staticBase={staticBase}
        isAdmin={isAdmin}
        onClose={() => {
          setDetailMovieId(null);
          setDetailMovieTitle("");
        }}
      />
    </div>
  );
}
