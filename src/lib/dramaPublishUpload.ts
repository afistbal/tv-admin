import { getAuthToken } from "@/api/authToken";
import { buildUrl } from "@/api/client";
import type { ApiResult } from "@/api/types";
import { uploadDramaAssetToCos } from "@/lib/cosDramaUpload";
import { readCosUploadConfig } from "@/lib/cosUploadConfig";

function clientUploadHeaders(): Record<string, string> {
  return {
    Accept: "application/json",
    "Accept-Language": localStorage.getItem("locale") ?? "zh-CN",
    Authorization: `Bearer ${getAuthToken()}`,
    "X-Platform": "web",
    "X-OS": "unknown",
    "X-Test": localStorage.getItem("test") ?? "",
    "X-Source": localStorage.getItem("source") ?? "",
  };
}

function resolveUploadKey(d: unknown): string | null {
  if (typeof d === "string" && d.trim()) {
    return d.trim();
  }
  if (d != null && typeof d === "object") {
    const o = d as Record<string, unknown>;
    for (const k of ["key", "filename", "path", "name"] as const) {
      const v = o[k];
      if (typeof v === "string" && v.trim()) {
        return v.trim();
      }
    }
  }
  return null;
}

function uploadDramaAssetViaApi(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", buildUrl("admin/movie/upload"));
    for (const [k, v] of Object.entries(clientUploadHeaders())) {
      xhr.setRequestHeader(k, v);
    }
    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) {
        return;
      }
      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText) as ApiResult<unknown>;
        if (res.c !== 0) {
          reject(new Error(res.m || "上传失败"));
          return;
        }
        const key = resolveUploadKey(res.d);
        if (!key) {
          reject(new Error("上传响应缺少 key"));
          return;
        }
        resolve(key);
      } catch {
        reject(new Error("上传响应解析失败"));
      }
    };
    xhr.onerror = () => reject(new Error("网络异常"));
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

/** 上传封面 / 视频 / 字幕，返回 publish 用的 storage key */
export async function uploadDramaAsset(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const cfg = readCosUploadConfig();
  if (cfg.enabled) {
    return uploadDramaAssetToCos(file, onProgress);
  }
  return uploadDramaAssetViaApi(file, onProgress);
}
