import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Space, Table, Typography, message } from "antd";
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

function formatDateTime(input: Date) {
  return `${input.getFullYear()}-${pad(input.getMonth() + 1)}-${pad(input.getDate())} ${pad(input.getHours())}:${pad(input.getMinutes())}:${pad(input.getSeconds())}`;
}

function weekDateRange(): readonly [string, string] {
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  return [formatDateTime(start), formatDateTime(end)] as const;
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
 * 移植自 slot_old `WeeklyUpdateTable`（`/page/week-data`）：近 7 日 `movie/listnew`；
 * 同一剧多集合并「名称」列单元格；名称、链接带复制。
 */
export function DramaLatestUpdate() {
  const staticBase = useAppStaticBase() ?? "";
  const [list, setList] = useState<TRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [clientPage, setClientPage] = useState(1);
  const dateRange = useMemo(() => weekDateRange(), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q: Record<string, ApiGetQueryValue> = {
        daterange: JSON.stringify([dateRange[0], dateRange[1]]),
      };
      const res: ApiResult<MovieListNewPayload> = await apiGet<MovieListNewPayload>("movie/listnew", q);
      if (res.c !== 0) {
        message.error(res.m || "加载失败");
        setList([]);
        setTotal(0);
        return;
      }
      const d = res.d;
      setList(Array.isArray(d?.data) ? d.data : []);
      setTotal(Number(d?.count) || 0);
    } catch {
      message.error("网络异常");
      setList([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo<EpisodeRow[]>(() => {
    return list.flatMap((row, groupIndex) => {
      const title = pickText(row, ["titile", "title", "name", "book_title"]);
      const outerTime = pickText(
        row,
        ["updated_at", "update_time", "time", "created_at", "publish_time", "publish_at"],
        "",
      );
      const raw = row["list"];
      if (!Array.isArray(raw) || raw.length === 0) {
        return [
          {
            key: `g${groupIndex}-0`,
            title,
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
          key: `g${groupIndex}-${index}`,
          title,
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
  }, [list, staticBase]);

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
        width: 240,
        onCell: (_: EpisodeRow, rowIndex: number) => ({
          rowSpan: titleRowSpans[rowIndex] ?? 1,
        }),
        render: (title: string) => (
          <div className={styles.titleCell}>
            <Typography.Text className={orderStyles.userIdText} ellipsis={{ tooltip: true }} copyable={title && title !== "—" ? { text: title } : false}>
              {title}
            </Typography.Text>
          </div>
        ),
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
        ellipsis: false,
        minWidth: 280,
        render: (addr: string) => {
          const a = String(addr ?? "");
          const isLink = /^https?:\/\//.test(a) || a.startsWith("/");
          const copyable = a && a !== "—" ? { text: a } : false;
          return (
            <div className={styles.addrCell}>
              <Typography.Text className={orderStyles.userIdText} ellipsis={{ tooltip: true }} copyable={copyable}>
                {isLink ? (
                  <a href={a} target={a.startsWith("http") ? "_blank" : undefined} rel={a.startsWith("http") ? "noreferrer" : undefined}>
                    {a}
                  </a>
                ) : (
                  a
                )}
              </Typography.Text>
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
      <Typography.Text type="secondary" style={{ display: "block", marginBottom: 4 }}>
        近 7 日剧集更新数据
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
          scroll={{ x: 960 }}
        />
      </div>

      <div className={styles.footer}>
        <div className={styles.footerStat}>
          影剧总数: {total} | 展示总行数: {rows.length}
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
