import { DownloadOutlined } from "@ant-design/icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, DatePicker, Image, Input, Space, Table, Tooltip, Typography, message } from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import type { ColumnsType } from "antd/es/table";
import { apiGet } from "@/api/client";
import type { ApiGetQueryValue } from "@/api/client";
import type { ApiResult } from "@/api/types";
import { useAppStaticBase } from "@/config/AppConfigContext";
import orderStyles from "./OrderList.module.css";
import styles from "./DramaLatestUpdate.module.css";

const COS_FALLBACK_BASE = "https://cos.yogoshort.com";
const CLIENT_PAGE_SIZE = 200;

function pad(num: number) {
  return String(num).padStart(2, "0");
}

function defaultDateRange(): [Dayjs, Dayjs] {
  const end = dayjs().startOf("day");
  const start = end.subtract(6, "day");
  return [start, end];
}

/** 与 slot `movie/listnew` 一致：daterange JSON 二元组，起止含整天 */
function rangeToApiStrings(range: [Dayjs, Dayjs]): [string, string] {
  const [from, to] = range;
  let a = from.startOf("day");
  let b = to.startOf("day");
  if (a.isAfter(b)) {
    const t = a;
    a = b;
    b = t;
  }
  return [
    a.format("YYYY-MM-DD HH:mm:ss"),
    b.endOf("day").format("YYYY-MM-DD HH:mm:ss"),
  ];
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
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
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

/** 取封面相对路径的文件名，用于下载名 `{id}_{image}` */
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

/**
 * 与 `vite.config` 中 `/__cos` 代理一致：把 COS 绝对地址换成本站路径，便于同源 fetch 得到 Blob 并触发本地下载。
 * 生产环境需在 nginx 等配置同等反代，并设置 `VITE_STATIC_DOWNLOAD_PROXY=1`。
 */
function tryCosSameOriginFetchUrl(imageUrl: string): string | null {
  const proxyOn =
    import.meta.env.DEV || String(import.meta.env.VITE_STATIC_DOWNLOAD_PROXY ?? "").trim() === "1";
  if (!proxyOn || typeof window === "undefined") {
    return null;
  }
  const rawTarget = String(import.meta.env.VITE_COS_PROXY_TARGET ?? "").trim() || "https://cos.yogoshort.com";
  try {
    const img = new URL(imageUrl);
    const base = new URL(rawTarget.match(/^https?:\/\//i) ? rawTarget : `https://${rawTarget}`);
    if (img.origin !== base.origin) {
      return null;
    }
    return `${window.location.origin}/__cos${img.pathname}${img.search}`;
  } catch {
    return null;
  }
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
  const proxied = tryCosSameOriginFetchUrl(url);
  const fetchUrls = Array.from(new Set([url, proxied].filter((u): u is string => Boolean(u))));

  for (const fetchUrl of fetchUrls) {
    try {
      const res = await fetch(fetchUrl, { mode: "cors", credentials: "omit", cache: "no-store" });
      if (!res.ok) {
        continue;
      }
      const blob = await res.blob();
      if (!blob || blob.size === 0) {
        continue;
      }
      triggerBlobDownload(blob, safeName);
      message.success("已开始下载");
      return;
    } catch {
      /* 试下一 URL */
    }
  }

  if (await downloadImageViaCanvas(url, safeName)) {
    message.success("已开始下载");
    return;
  }

  message.error(
    "无法直接保存到本地（跨域限制）。开发环境已走 /__cos 代理；生产请配置同源反代并设置 VITE_STATIC_DOWNLOAD_PROXY=1，或在大图预览里右键另存为。",
  );
}

function toFallbackAddress(row: TRow) {
  const direct = pickText(row, ["address", "url", "href", "link", "episode_url", "episode_href"], "");
  if (direct) {
    return direct;
  }
  const id = row["id"];
  if (id !== undefined && id !== null && String(id).trim() !== "") {
    return `/video/${id}`;
  }
  const slug = pickText(row, ["episode_slug", "slug"], "");
  if (slug) {
    return `/episodes/${slug}`;
  }
  return "—";
}

type EpisodeRow = {
  key: string;
  title: string;
  /** 剧封图完整 URL，同一剧多集行共用，与名称列同步 rowSpan 合并 */
  coverUrl: string;
  /** 剧目 id，用于展示与下载文件名 */
  dramaId: string;
  /** 封面原文件名（接口 image 字段 basename），下载名 `{dramaId}_{coverImageFile}` */
  coverImageFile: string;
  time: string;
  episode: string;
  address: string;
  groupIndex: number;
};

type MovieListNewPayload = {
  data?: TRow[];
  count?: number;
};

function computeTitleRowSpans(rows: EpisodeRow[]): number[] {
  const result = rows.map(() => 0);
  const countByGroup = new Map<number, number>();
  const firstIndexByGroup = new Map<number, number>();
  rows.forEach((r, i) => {
    countByGroup.set(r.groupIndex, (countByGroup.get(r.groupIndex) ?? 0) + 1);
    if (!firstIndexByGroup.has(r.groupIndex)) {
      firstIndexByGroup.set(r.groupIndex, i);
    }
  });
  rows.forEach((r, i) => {
    const first = firstIndexByGroup.get(r.groupIndex);
    if (first === i) {
      result[i] = countByGroup.get(r.groupIndex) ?? 1;
    } else {
      result[i] = 0;
    }
  });
  return result;
}

/**
 * 进入页面：默认近 7 日时间范围自动请求 `movie/listnew`（与点「更新列表」相同）。
 * 之后：点「更新列表」→ 仅按时间范围请求 → 成功后再用当前名称对本次结果做前端模糊匹配（`title`）。
 * 「查询」：不重复请求，仅按名称重筛当前已拉取的数据。
 */
export function DramaLatestUpdate() {
  const staticBase = useAppStaticBase() ?? "";
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>(() => defaultDateRange());
  const [titleKeyword, setTitleKeyword] = useState("");
  /** 与接口返回同步快照：仅在「更新列表」成功返回后写入；「查询」只更新此项 */
  const [appliedTitle, setAppliedTitle] = useState("");
  const [apiList, setApiList] = useState<TRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);
  const [clientPage, setClientPage] = useState(1);

  const fetchByDateRange = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    try {
      const [s, e] = rangeToApiStrings(dateRange);
      const q: Record<string, ApiGetQueryValue> = {
        daterange: JSON.stringify([s, e]),
      };
      const res: ApiResult<MovieListNewPayload> = await apiGet<MovieListNewPayload>("movie/listnew", q);
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
      setTotal(Number(d?.count) || 0);
      setHasFetched(true);
      return true;
    } catch {
      message.error("网络异常");
      setApiList([]);
      setTotal(0);
      setHasFetched(false);
      return false;
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  /** 更新列表：先接口，成功后再把当前名称框内容作为 appliedTitle（对本次数据筛选） */
  const handleSearch = useCallback(async () => {
    const ok = await fetchByDateRange();
    if (ok) {
      setAppliedTitle(titleKeyword.trim());
      setClientPage(1);
    }
  }, [fetchByDateRange, titleKeyword]);

  /** 进入页面：默认时间范围自动拉取（与点「更新列表」一致） */
  useEffect(() => {
    void handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅挂载一次；改日期后请手动点「更新列表」
  }, []);

  /** 仅名称：对已返回的数据再筛，不调接口 */
  const handleFilterTitle = useCallback(() => {
    if (!hasFetched) {
      message.warning("请先点击「更新列表」拉取时间范围内的数据");
      return;
    }
    setAppliedTitle(titleKeyword.trim());
    setClientPage(1);
  }, [hasFetched, titleKeyword]);

  const filteredApiList = useMemo(() => {
    const kw = appliedTitle.trim().toLowerCase();
    if (!kw) {
      return apiList;
    }
    return apiList.filter((row) => rowTitle(row).toLowerCase().includes(kw));
  }, [apiList, appliedTitle]);

  const rows = useMemo<EpisodeRow[]>(() => {
    return filteredApiList.flatMap((row, groupIndex) => {
      const title = rowTitle(row);
      const outerTime = pickText(
        row,
        ["updated_at", "update_time", "time", "created_at", "publish_time", "publish_at"],
        "",
      );
      const raw = row["list"];
      const rowId = row["id"] != null ? String(row["id"]) : String(groupIndex);
      const coverPath = pickText(row, ["image", "poster", "cover", "thumb", "cover_image"], "");
      const coverUrl = coverPath ? joinUrl(staticBase, coverPath) : "";
      const dramaId = row["id"] != null ? String(row["id"]) : "";
      const coverImageFile = coverPath ? imageBasename(coverPath) : "";
      if (!Array.isArray(raw) || raw.length === 0) {
        return [
          {
            key: `g${rowId}-0`,
            title,
            coverUrl,
            dramaId,
            coverImageFile,
            time: formatDisplayTime(outerTime || "—"),
            episode: pickText(row, ["episode", "episodes", "currentEp", "current_ep", "videos"]),
            address: toFallbackAddress(row),
            groupIndex,
          },
        ];
      }
      return raw.map((item, index) => {
        const record = item as Record<string, unknown>;
        const episodeValue = record["episode"];
        const video = String(record["video"] ?? "").trim();
        const address = video ? joinUrl(staticBase, video) : toFallbackAddress(row);
        const normalizedEpisode = Number(episodeValue);
        const innerTime = pickText(
          record as TRow,
          ["updated_at", "update_time", "time", "created_at", "publish_time", "publish_at"],
          "",
        );
        return {
          key: `g${rowId}-${index}`,
          title,
          coverUrl,
          dramaId,
          coverImageFile,
          time: formatDisplayTime(outerTime || innerTime || "—"),
          episode:
            Number.isFinite(normalizedEpisode) && normalizedEpisode > 0
              ? String(normalizedEpisode)
              : String(index + 1),
          address,
          groupIndex,
        };
      });
    });
  }, [filteredApiList, staticBase]);

  const clientTotalPage = Math.max(1, Math.ceil(rows.length / CLIENT_PAGE_SIZE));
  const pagedRows = useMemo(() => {
    const start = (clientPage - 1) * CLIENT_PAGE_SIZE;
    return rows.slice(start, start + CLIENT_PAGE_SIZE);
  }, [clientPage, rows]);

  const titleRowSpans = useMemo(() => computeTitleRowSpans(pagedRows), [pagedRows]);

  useEffect(() => {
    setClientPage(1);
  }, [rows.length]);

  const goPage = (next: number) => {
    const target = Math.min(Math.max(1, next), clientTotalPage);
    setClientPage(target);
  };

  const columns: ColumnsType<EpisodeRow> = useMemo(
    () => [
      {
        title: "名称",
        dataIndex: "title",
        key: "title",
        className: styles.titleColumn,
        width: 200,
        ellipsis: false,
        onCell: (_: EpisodeRow, index?: number) => ({
          rowSpan: index === undefined ? 1 : (titleRowSpans[index] ?? 1),
          className: styles.titleColumnCell,
        }),
        render: (title: string) => (
          <div className={styles.titleCell}>
            <Typography.Text
              className={styles.titleText}
              copyable={title && title !== "—" ? { text: title } : false}
            >
              {title}
            </Typography.Text>
          </div>
        ),
      },
      {
        title: "封面",
        key: "cover",
        width: 160,
        align: "center",
        onCell: (_: EpisodeRow, index?: number) => ({
          rowSpan: index === undefined ? 1 : (titleRowSpans[index] ?? 1),
        }),
        render: (_: unknown, record: EpisodeRow) => {
          const url = record.coverUrl?.trim();
          const idLine = record.dramaId ? `id: ${record.dramaId}` : "id: —";
          const canDownload = Boolean(url && record.dramaId && record.coverImageFile);
          const downloadFilename =
            record.dramaId && record.coverImageFile ? `${record.dramaId}_${record.coverImageFile}` : "";

          const downloadTip = !url
            ? "无封面可下载"
            : canDownload
              ? `下载 ${downloadFilename}`
              : !record.dramaId
                ? "缺少剧目 id，无法按规范命名下载"
                : "缺少封面文件名";

          const meta = (
            <div className={styles.coverMeta}>
              <Typography.Text type="secondary" className={styles.coverIdLine}>
                {idLine}
              </Typography.Text>
              <Tooltip title={downloadTip}>
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
          );

          if (!url) {
            return (
              <div className={styles.coverCell}>
                {meta}
                <Typography.Text type="secondary">—</Typography.Text>
              </div>
            );
          }

          return (
            <div className={styles.coverCell}>
              {meta}
              <Image
                src={url}
                alt=""
                width={112}
                height={148}
                className={styles.coverThumb}
                preview={{ mask: "查看大图" }}
              />
            </div>
          );
        },
      },
      {
        title: "时间",
        dataIndex: "time",
        key: "time",
        width: 168,
        render: (t: string) => <Typography.Text>{t}</Typography.Text>,
      },
      {
        title: "集数",
        dataIndex: "episode",
        key: "episode",
        width: 72,
      },
      {
        title: "地址",
        dataIndex: "address",
        key: "address",
        ellipsis: true,
        width: 320,
        render: (addr: string) => {
          const a = String(addr ?? "");
          const isHttp = /^https?:\/\//.test(a);
          const isPath = a.startsWith("/");
          const copyable = a && a !== "—" ? { text: a } : false;
          const tip = a && a !== "—" ? a : undefined;
          const body =
            isHttp && tip ? (
              <a
                className={styles.addrLinkInner}
                href={a}
                target="_blank"
                rel="noreferrer"
              >
                {a}
              </a>
            ) : isPath && tip ? (
              <a className={styles.addrLinkInner} href={a}>
                {a}
              </a>
            ) : (
              <span className={styles.addrPlain}>{a}</span>
            );
          return (
            <div className={styles.addrCell}>
              <Tooltip title={tip} placement="topLeft">
                <div className={styles.addrEllipsis}>{body}</div>
              </Tooltip>
              {copyable ? <Typography.Text className={styles.addrCopy} copyable={copyable} /> : null}
            </div>
          );
        },
      },
    ],
    [titleRowSpans],
  );

  return (
    <div className={styles.page}>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        最新更新
      </Typography.Title>

      <div className={orderStyles.filterWrap}>
        <div className={orderStyles.filterBar}>
          <div className={orderStyles.filterItem}>
            <span className={orderStyles.filterLabel}>时间范围：</span>
            <DatePicker.RangePicker
              className={orderStyles.dateRange}
              format="YYYY-MM-DD"
              allowClear={false}
              value={dateRange}
              onChange={(dates) => {
                if (dates?.[0] && dates[1]) {
                  let a = dates[0].startOf("day");
                  let b = dates[1].startOf("day");
                  if (a.isAfter(b)) {
                    const t = a;
                    a = b;
                    b = t;
                  }
                  setDateRange([a, b]);
                }
              }}
            />
            <Button type="primary" loading={loading} onClick={() => void handleSearch()}>
              更新列表
            </Button>
          </div>
          <div className={orderStyles.filterItem}>
            <span className={orderStyles.filterLabel}>名称：</span>
            <Input
              allowClear
              placeholder={hasFetched ? "模糊匹配 title" : "拉取完成后可输入"}
              disabled={!hasFetched}
              value={titleKeyword}
              onChange={(e) => setTitleKeyword(e.target.value)}
              style={{ width: 220 }}
              maxLength={128}
            />
            <Button disabled={!hasFetched || loading} onClick={handleFilterTitle}>
              查询
            </Button>
          </div>
        </div>
      </div>

      <Typography.Text type="secondary" style={{ display: "block", marginBottom: 4 }}>
        进入页面已按默认时间自动请求；修改时间后请点「更新列表」。名称在数据返回后可填，点「更新列表」会重新请求并带上名称筛选，点「查询」只筛当前结果。
      </Typography.Text>

      <div className={styles.tableScroll}>
        <Table<EpisodeRow>
          rowKey="key"
          loading={loading}
          columns={columns}
          dataSource={pagedRows}
          pagination={false}
          size="middle"
          tableLayout="fixed"
          scroll={{ x: 1140 }}
          locale={{
            emptyText: loading ? "加载中…" : hasFetched ? "暂无数据" : "请点击「更新列表」拉取数据",
          }}
        />
      </div>

      <div className={styles.footer}>
        <div className={styles.footerStat}>
          接口影剧数: {total} | 当前匹配剧: {filteredApiList.length} | 展示行数: {rows.length}
        </div>
        <Space className={styles.footerPager} wrap>
          <Button type="default" disabled={clientPage <= 1} onClick={() => goPage(clientPage - 1)}>
            上一页
          </Button>
          <Typography.Text strong>
            第 {clientPage} / {clientTotalPage} 页（每页 {CLIENT_PAGE_SIZE} 条）
          </Typography.Text>
          <Button type="default" disabled={clientPage >= clientTotalPage} onClick={() => goPage(clientPage + 1)}>
            下一页
          </Button>
        </Space>
      </div>
    </div>
  );
}
