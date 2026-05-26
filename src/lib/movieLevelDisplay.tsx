import type { ReactNode } from "react";
import { Tag } from "antd";
import type { NotionTagTone } from "@/lib/subscriptionUserDisplay";
import { NotionTag } from "@/components/NotionTag";
import playStyles from "./movieLevelDisplay.module.css";

export type MovieLevelKey = "n" | "a" | "b";

const LEVEL_LABEL: Record<MovieLevelKey, string> = {
  n: "N级",
  a: "A级",
  b: "B级",
};

const LEVEL_TONE: Record<MovieLevelKey, NotionTagTone> = {
  n: { label: "N级", dot: "#7c3aed", bg: "rgba(124, 58, 237, 0.12)" },
  a: { label: "A级", dot: "#d97706", bg: "rgba(217, 119, 6, 0.12)" },
  b: { label: "B级", dot: "#059669", bg: "rgba(5, 150, 105, 0.12)" },
};

export function parseMovieLevel(raw: unknown): MovieLevelKey | null {
  if (raw == null || raw === "") {
    return null;
  }
  const s = String(raw).trim().toLowerCase();
  if (s === "n" || s === "n级" || s === "n级剧") {
    return "n";
  }
  if (s === "a" || s === "a级" || s === "a级剧") {
    return "a";
  }
  if (s === "b" || s === "b级" || s === "b级剧") {
    return "b";
  }
  return null;
}

export function movieLevelFromRow(row: Record<string, unknown> | undefined): MovieLevelKey | null {
  if (!row) {
    return null;
  }
  return parseMovieLevel(row.level ?? row.grade ?? row.movie_level ?? row.tier);
}

export function movieLevelLabel(level: MovieLevelKey | null): string {
  return level ? LEVEL_LABEL[level] : "—";
}

export function movieLevelTag(level: MovieLevelKey | null): ReactNode {
  if (!level) {
    return "—";
  }
  return <NotionTag tone={LEVEL_TONE[level]} />;
}

export function movieLevelAntTag(level: MovieLevelKey | null): ReactNode {
  if (!level) {
    return "—";
  }
  const color = level === "n" ? "purple" : level === "a" ? "gold" : "green";
  return <Tag color={color}>{LEVEL_LABEL[level]}</Tag>;
}

export const MOVIE_LEVEL_FILTER_OPTIONS = [
  { value: "all", label: "全部级别" },
  { value: "n", label: "N级" },
  { value: "a", label: "A级" },
  { value: "b", label: "B级" },
] as const;

export type MovieLevelFilter = (typeof MOVIE_LEVEL_FILTER_OPTIONS)[number]["value"];

export function formatCompactCount(n: unknown): string {
  const v = Number(n);
  if (!Number.isFinite(v)) {
    return "—";
  }
  return v.toLocaleString("zh-CN");
}

export function readTotalPlay(row: Record<string, unknown> | undefined): number | null {
  if (!row) {
    return null;
  }
  const n = Number(row.play);
  return Number.isFinite(n) ? n : null;
}

export function readViews7d(row: Record<string, unknown> | undefined): number | null {
  if (!row) {
    return null;
  }
  const v =
    row.play_7days ??
    row.views_7d ??
    row.view_count_7d ??
    row.play_count_7d ??
    row.views7d ??
    row.play_count;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function MoviePlayCountCell({ row }: { row: Record<string, unknown> | undefined }) {
  const total = readTotalPlay(row);
  const views7d = readViews7d(row);
  return (
    <div className={playStyles.playCell}>
      <div className={playStyles.playLine}>
        <span className={playStyles.playLabel}>总播放量：</span>
        <span>{formatCompactCount(total)}</span>
      </div>
      <div className={playStyles.playLine}>
        <span className={playStyles.playLabel}>7天播放量：</span>
        <span>{formatCompactCount(views7d)}</span>
      </div>
    </div>
  );
}

export function readFavoriteCount(row: Record<string, unknown> | undefined): number | null {
  if (!row) {
    return null;
  }
  const v = row.favorites ?? row.favorite_count ?? row.collect_count ?? row.favorite;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function formatDateYmd(v: string | null | undefined): string {
  if (v == null || v === "") {
    return "—";
  }
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) {
    const m = String(v).match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : String(v);
  }
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
