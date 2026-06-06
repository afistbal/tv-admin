import { apiPostJson } from "@/api/client";
import type { ApiResult } from "@/api/types";
import { checkImageUrlExists, movieWatermarkCoverPath, movieWatermarkCoverUrl } from "@/lib/staticAssetOrigin";

export type BatchWatermarkLogStatus = "success" | "missing" | "error";

export type BatchWatermarkLogLine = {
  key: string;
  movieId: number;
  status: BatchWatermarkLogStatus;
  message: string;
};

/** 从 `9706.webp`、纯数字等输入解析剧目 ID（去重、保序） */
export function parseWatermarkMovieIds(input: string): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();
  const chunks = input.split(/[\r\n,;]+/);

  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed) {
      continue;
    }
    const matched = trimmed.match(/(\d+)(?:\.webp)?$/i);
    if (!matched) {
      continue;
    }
    const id = Number(matched[1]);
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) {
      continue;
    }
    seen.add(id);
    ids.push(id);
  }

  return ids;
}

export async function enableMovieWatermark(
  movieId: number,
  staticBase: string | null | undefined,
): Promise<{ ok: true } | { ok: false; status: BatchWatermarkLogStatus; message: string }> {
  const watermarkUrl = movieWatermarkCoverUrl(movieId, staticBase);
  if (!watermarkUrl) {
    return { ok: false, status: "error", message: "未配置静态资源，无法校验水印图" };
  }

  const exists = await checkImageUrlExists(watermarkUrl);
  if (!exists) {
    return {
      ok: false,
      status: "missing",
      message: `资源不存在：${movieWatermarkCoverPath(movieId)}`,
    };
  }

  try {
    const res: ApiResult<unknown> = await apiPostJson("admin/language/save", {
      id: movieId,
      is_rename: 1,
    });
    if (res.c !== 0) {
      return { ok: false, status: "error", message: res.m || "开启失败" };
    }
    return { ok: true };
  } catch {
    return { ok: false, status: "error", message: "网络异常" };
  }
}

export async function runBatchEnableWatermark(
  movieIds: number[],
  staticBase: string | null | undefined,
  onLine: (line: BatchWatermarkLogLine) => void,
): Promise<{ successCount: number; failCount: number; missingCount: number }> {
  let successCount = 0;
  let failCount = 0;
  let missingCount = 0;

  for (let index = 0; index < movieIds.length; index += 1) {
    const movieId = movieIds[index];
    const result = await enableMovieWatermark(movieId, staticBase);
    if (result.ok) {
      successCount += 1;
      onLine({
        key: `${index}-${movieId}-success`,
        movieId,
        status: "success",
        message: "开启水印成功",
      });
      continue;
    }

    if (result.status === "missing") {
      missingCount += 1;
    } else {
      failCount += 1;
    }

    onLine({
      key: `${index}-${movieId}-${result.status}`,
      movieId,
      status: result.status,
      message: result.message,
    });
  }

  return { successCount, failCount, missingCount };
}
