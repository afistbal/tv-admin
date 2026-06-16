import { apiPostJson } from "@/api/client";
import type { ApiResult } from "@/api/types";

export type PublishEpisodePayload = {
  ep: number;
  video_key: string;
  /** 手动上传时的原始文件名 */
  alias_name?: string;
  subtitle_key?: string;
  vip: 0 | 1;
};

export type PublishMoviePayload = {
  movie_id?: number;
  title: string;
  language: string;
  introduction: string;
  cover_key: string;
  audio_track: "zh-Hans" | "en";
  sort: number;
  status: number;
  tags: number[];
  area: string[];
  episodes: PublishEpisodePayload[];
};

export type PublishMovieResult = {
  movie_id: number;
};

export function mediaStorageKey(path: string | undefined | null): string {
  const s = String(path ?? "").trim();
  if (!s) {
    return "";
  }
  const i = s.lastIndexOf("/");
  return i >= 0 ? s.slice(i + 1) : s;
}

/** 剧表 `source`：`0` 自动拉取、`1` 手动上传 */
export function isOriginalMovieSource(source: unknown): boolean {
  return Number(source) === 1;
}

export async function publishMovie(payload: PublishMoviePayload): Promise<ApiResult<PublishMovieResult>> {
  return apiPostJson<PublishMovieResult>("admin/movie/publish", payload as unknown as Record<string, unknown>);
}

/** 从文件名提取集号：取第一段连续数字 */
export function extractEpisodeNumFromFileName(fileName: string): number | null {
  const matched = fileName.match(/\d+/);
  if (!matched) {
    return null;
  }
  const n = Number(matched[0]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function baseNameWithoutExt(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "").toLowerCase();
}
