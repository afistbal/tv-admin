import type { AdminMovieDetailPayload } from "@/types/adminMovie";
import { readMovieIsSelf } from "@/lib/staticAssetOrigin";

export type MovieSavePayload = {
  id: number;
  title: string;
  title_original: string;
  site_favorite: number;
  favorite_offset: number;
  sort: string;
  audio_track: string;
  area: number[];
  tag: number[];
  episodes: { id: number; vip: number }[];
  is_self: number;
};

export function readAudioTrackFromInfo(info: Record<string, unknown>): string {
  const track = info["audio_track"];
  return track == null || track === "" ? "zh-Hans" : String(track) === "en" ? "en" : "zh-Hans";
}

export function buildMovieSavePayload(
  movieId: number,
  detail: AdminMovieDetailPayload,
  options?: {
    is_self?: number;
    episodes?: { id: number; vip: number }[];
    title?: string;
    title_original?: string;
    site_favorite?: number;
    favorite_offset?: number;
    sort?: string;
    audio_track?: string;
    area?: number[];
    tag?: number[];
  },
): MovieSavePayload {
  const info = detail.info;
  return {
    id: movieId,
    title: options?.title ?? String(info["title"] ?? ""),
    title_original: options?.title_original ?? String(info["title_original"] ?? ""),
    site_favorite: options?.site_favorite ?? Number(info["site_favorite"] ?? 0),
    favorite_offset: options?.favorite_offset ?? Number(info["favorite_offset"] ?? 0),
    sort: options?.sort ?? (info["sort"] != null && info["sort"] !== "" ? String(info["sort"]) : ""),
    audio_track: options?.audio_track ?? readAudioTrackFromInfo(info),
    area: options?.area ?? detail.area,
    tag: options?.tag ?? detail.tag,
    episodes: options?.episodes ?? [],
    is_self: options?.is_self ?? (readMovieIsSelf(info) ? 1 : 0),
  };
}
