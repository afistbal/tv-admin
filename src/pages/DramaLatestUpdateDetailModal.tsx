import { useEffect, useMemo, useState } from "react";
import { Modal, Table, Tooltip, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  LATEST_UPDATE_DETAIL_PAGE_SIZE,
  LATEST_UPDATE_GUEST_DETAIL_PAGE_SIZE,
  episodesFromDetailPayload,
  fetchLatestUpdateDetail,
} from "@/lib/dramaLatestUpdateApi";
import type { AdminMovieEpisodeRow } from "@/types/adminMovie";
import styles from "./DramaLatestUpdate.module.css";

const COS_FALLBACK_BASE = "https://cos.yogoshort.com";

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

/** 字幕路径：接口多在集数顶层 `url`（.vtt），兼容 `subtitle.url` */
function subtitleUrlFromEpisode(item: AdminMovieEpisodeRow): string {
  const top = item.url;
  if (top != null && String(top).trim() !== "") {
    return String(top).trim();
  }
  const st = item.subtitle;
  if (st != null && typeof st === "object") {
    const nested = (st as { url?: unknown }).url;
    if (nested != null && String(nested).trim() !== "") {
      return String(nested).trim();
    }
  }
  return "";
}

type EpisodeDisplayRow = {
  key: string;
  episode: string;
  videoUrl: string;
  subtitleUrl: string;
};

function UrlLine({ label, url }: { label: string; url: string }) {
  const text = url.trim();
  if (!text) {
    return (
      <div className={styles.episodeUrlLine}>
        <span className={styles.episodeUrlLabel}>{label}</span>
        <span className={styles.episodeUrlValue}>—</span>
      </div>
    );
  }
  const isHttp = /^https?:\/\//.test(text);
  return (
    <div className={styles.episodeUrlLine}>
      <span className={styles.episodeUrlLabel}>{label}</span>
      <div className={styles.episodeUrlValue}>
        <div className={styles.addrCell}>
          <Tooltip title={text} placement="topLeft">
            <div className={styles.addrEllipsis}>
              {isHttp ? (
                <a className={styles.addrLinkInner} href={text} target="_blank" rel="noreferrer">
                  {text}
                </a>
              ) : (
                <span className={styles.addrPlain}>{text}</span>
              )}
            </div>
          </Tooltip>
          <Typography.Text className={styles.addrCopy} copyable={{ text }} />
        </div>
      </div>
    </div>
  );
}

type Props = {
  open: boolean;
  movieId: number | null;
  movieTitle: string;
  staticBase: string;
  isAdmin: boolean;
  onClose: () => void;
};

export function DramaLatestUpdateDetailModal({
  open,
  movieId,
  movieTitle,
  staticBase,
  isAdmin,
  onClose,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [episodes, setEpisodes] = useState<AdminMovieEpisodeRow[]>([]);

  useEffect(() => {
    if (!open || movieId == null) {
      setEpisodes([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetchLatestUpdateDetail(movieId, isAdmin);
        if (cancelled) {
          return;
        }
        if (res.c !== 0) {
          message.error(res.m || "加载集数失败");
          setEpisodes([]);
          return;
        }
        setEpisodes(episodesFromDetailPayload(res.d));
      } catch {
        if (!cancelled) {
          message.error("网络异常");
          setEpisodes([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, movieId, isAdmin]);

  const rows = useMemo<EpisodeDisplayRow[]>(() => {
    return episodes.map((item, index) => {
      const episodeValue = item.episode;
      const videoRaw = String(item.video ?? "").trim();
      const videoUrl = videoRaw ? joinUrl(staticBase, videoRaw) : "";
      const subtitleRaw = subtitleUrlFromEpisode(item);
      const subtitleUrl = subtitleRaw ? joinUrl(staticBase, subtitleRaw) : "";
      const normalizedEpisode = Number(episodeValue);
      return {
        key: String(item.id ?? `ep-${index}`),
        episode:
          Number.isFinite(normalizedEpisode) && normalizedEpisode > 0
            ? String(normalizedEpisode)
            : String(index + 1),
        videoUrl,
        subtitleUrl,
      };
    });
  }, [episodes, staticBase]);

  const columns: ColumnsType<EpisodeDisplayRow> = useMemo(
    () => [
      {
        title: "集数",
        dataIndex: "episode",
        key: "episode",
        width: 72,
        align: "center",
        fixed: "left",
      },
      {
        title: "链接",
        key: "urls",
        render: (_: unknown, record: EpisodeDisplayRow) => (
          <div className={styles.episodeUrlCell}>
            <UrlLine label="视频：" url={record.videoUrl} />
            {record.subtitleUrl.trim() ? <UrlLine label="字幕：" url={record.subtitleUrl} /> : null}
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <Modal
      title={movieTitle ? `${movieTitle} · 集数详情` : "集数详情"}
      open={open}
      onCancel={onClose}
      footer={null}
      width={960}
      destroyOnClose
      maskClosable={!loading}
      className={styles.detailModal}
      styles={{ body: { maxHeight: "calc(100vh - 200px)", overflow: "auto" } }}
    >
      <Typography.Text type="secondary" className={styles.detailModalMeta}>
        剧目 ID：{movieId ?? "—"}
        {isAdmin
          ? ` · 每页最多 ${LATEST_UPDATE_DETAIL_PAGE_SIZE} 集`
          : ` · 最多展示 ${LATEST_UPDATE_GUEST_DETAIL_PAGE_SIZE} 集`}
      </Typography.Text>
      <Table<EpisodeDisplayRow>
        rowKey="key"
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={false}
        size="middle"
        tableLayout="fixed"
        scroll={{ x: 840, y: 480 }}
        locale={{ emptyText: loading ? "加载中…" : "暂无集数" }}
      />
    </Modal>
  );
}
