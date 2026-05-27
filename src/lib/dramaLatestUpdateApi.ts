import { apiGet } from "@/api/client";
import type { ApiResult } from "@/api/types";
import type { AdminMovieEpisodeRow } from "@/types/adminMovie";

/** 列表默认每页条数（接口未返回 per_page 时用于分页展示） */
export const LATEST_UPDATE_LIST_DEFAULT_PER_PAGE = 200;
export const LATEST_UPDATE_DETAIL_PAGE_SIZE = 200;
/** 非管理员 detail 最多 14 集 */
export const LATEST_UPDATE_GUEST_DETAIL_PAGE_SIZE = 14;

/** 列表项与 `admin/movie/list` 行结构类似：`id` / `image` / `is_rename`（剧表） */
export type LatestUpdateListPayload = {
  data?: Record<string, unknown>[];
  count?: number;
  current_page?: number;
  per_page?: number;
};

export type LatestUpdateDetailPayload = {
  list?: AdminMovieEpisodeRow[];
  episodes?: AdminMovieEpisodeRow[];
  data?: AdminMovieEpisodeRow[];
  info?: Record<string, unknown>;
  [key: string]: unknown;
};

export function episodesFromDetailPayload(d: LatestUpdateDetailPayload | undefined): AdminMovieEpisodeRow[] {
  if (!d) {
    return [];
  }
  const raw = d.list ?? d.episodes ?? d.data;
  return Array.isArray(raw) ? raw : [];
}

export async function fetchLatestUpdateList(page: number): Promise<ApiResult<LatestUpdateListPayload>> {
  return apiGet<LatestUpdateListPayload>("admin/movie/listnew", { page });
}

export async function fetchLatestUpdateDetail(
  movieId: number,
  isAdmin: boolean,
): Promise<ApiResult<LatestUpdateDetailPayload>> {
  return apiGet<LatestUpdateDetailPayload>("admin/movie/detail", {
    movieid: movieId,
    pageSize: isAdmin ? LATEST_UPDATE_DETAIL_PAGE_SIZE : LATEST_UPDATE_GUEST_DETAIL_PAGE_SIZE,
  });
}
