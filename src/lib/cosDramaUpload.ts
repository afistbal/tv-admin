import COS from "cos-js-sdk-v5";
import { getAuthToken } from "@/api/authToken";
import { apiGet, buildUrl, isApiResultOk } from "@/api/client";
import type { ApiResult } from "@/api/types";
import {
  assertCosUploadConfig,
  buildCosObjectKey,
  cosKeyToPublishKey,
  normalizeCosPostUrl,
  readCosUploadConfig,
} from "@/lib/cosUploadConfig";

type OssFormPayload = {
  url: string;
  form: Record<string, string>;
};

type ResolvedSts = {
  tmpSecretId: string;
  tmpSecretKey: string;
  sessionToken: string;
  startTime: number;
  expiredTime: number;
  bucket: string;
  region: string;
  key: string;
};

function clientAuthHeaders(): Record<string, string> {
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

function fileExtension(name: string): string {
  const matched = name.match(/(\.[^./\\]+)$/i);
  return matched ? matched[1].toLowerCase() : "";
}

export async function buildHashedUploadFileName(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${hex}${fileExtension(file.name)}`;
}

function readNumber(raw: unknown): number | undefined {
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function parseOssFormPayload(raw: unknown): OssFormPayload {
  if (raw == null || typeof raw !== "object") {
    throw new Error("OSS form 响应格式错误");
  }
  const o = raw as Record<string, unknown>;
  const url = String(o.url ?? "").trim();
  const formRaw = o.form;
  if (!url || formRaw == null || typeof formRaw !== "object") {
    throw new Error("OSS form 响应缺少 url / form");
  }
  const form: Record<string, string> = {};
  for (const [k, v] of Object.entries(formRaw as Record<string, unknown>)) {
    if (v != null && String(v).trim()) {
      form[k] = String(v);
    }
  }
  if (!form.policy || !form["q-signature"]) {
    throw new Error("OSS form 签名字段不完整");
  }
  return { url, form };
}

async function fetchOssForm(): Promise<OssFormPayload> {
  const cfg = readCosUploadConfig();
  const res: ApiResult<unknown> = await apiGet<unknown>(cfg.ossFormPath);
  if (!isApiResultOk(res)) {
    throw new Error(res.m || "获取 OSS 认证表单失败");
  }
  return parseOssFormPayload(res.d);
}

/** GET /api/oss/form → POST 表单直传 COS */
async function uploadDramaAssetViaOssForm(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const cfg = readCosUploadConfig();
  const fileName = await buildHashedUploadFileName(file);
  const cosKey = buildCosObjectKey(cfg.keyPrefix, fileName);
  const { url, form } = await fetchOssForm();
  const postUrl = normalizeCosPostUrl(url);

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", postUrl);
    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) {
        return;
      }
      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(new Error(`COS 上传失败（HTTP ${xhr.status}）`));
    };
    xhr.onerror = () => reject(new Error("COS 上传网络异常"));

    const body = new FormData();
    for (const [k, v] of Object.entries(form)) {
      body.append(k, v);
    }
    body.append("key", cosKey);
    body.append("file", file);
    xhr.send(body);
  });

  return cosKeyToPublishKey(cosKey);
}

function parseStsPayload(raw: unknown, fallback: { bucket: string; region: string; key: string }): ResolvedSts {
  const payload =
    raw != null && typeof raw === "object" && "credentials" in (raw as object)
      ? (raw as Record<string, unknown>)
      : raw != null && typeof raw === "object" && "Credentials" in (raw as object)
        ? (raw as Record<string, unknown>)
        : (raw as Record<string, unknown>);

  const nestedCredentials = payload.credentials as Record<string, unknown> | undefined;
  const cloudCredentials = payload.Credentials as Record<string, unknown> | undefined;

  const tmpSecretId = String(
    nestedCredentials?.tmpSecretId ?? cloudCredentials?.TmpSecretId ?? payload.tmpSecretId ?? "",
  ).trim();
  const tmpSecretKey = String(
    nestedCredentials?.tmpSecretKey ?? cloudCredentials?.TmpSecretKey ?? payload.tmpSecretKey ?? "",
  ).trim();
  const sessionToken = String(
    nestedCredentials?.sessionToken ?? cloudCredentials?.Token ?? payload.sessionToken ?? "",
  ).trim();

  const startTime =
    readNumber(payload.startTime) ?? readNumber(payload.StartTime) ?? Math.floor(Date.now() / 1000);
  const expiredTime =
    readNumber(payload.expiredTime) ??
    readNumber(payload.ExpiredTime) ??
    startTime + 1800;

  const bucket = String(payload.bucket ?? fallback.bucket).trim();
  const region = String(payload.region ?? fallback.region).trim();
  const key = String(payload.key ?? fallback.key).trim();

  if (!tmpSecretId || !tmpSecretKey || !sessionToken) {
    throw new Error("STS 响应缺少临时密钥");
  }
  if (!bucket || !region || !key) {
    throw new Error("STS 响应缺少 bucket / region / key");
  }

  return {
    tmpSecretId,
    tmpSecretKey,
    sessionToken,
    startTime,
    expiredTime,
    bucket,
    region,
    key,
  };
}

async function fetchCosSts(file: File, cosKey: string): Promise<ResolvedSts> {
  const cfg = readCosUploadConfig();
  const fallback = {
    bucket: cfg.bucket,
    region: cfg.region,
    key: cosKey,
  };

  let response: Response;
  if (cfg.stsUrl) {
    const url = new URL(cfg.stsUrl);
    url.searchParams.set("filename", file.name);
    url.searchParams.set("key", cosKey);
    response = await fetch(url.toString(), { method: "GET", headers: { Accept: "application/json" } });
  } else {
    response = await fetch(buildUrl(cfg.stsApiPath, { filename: file.name, key: cosKey }), {
      method: "GET",
      headers: clientAuthHeaders(),
    });
  }

  const json: unknown = await response.json();
  if (cfg.stsUrl) {
    const err = json != null && typeof json === "object" ? (json as { error?: string }).error : undefined;
    if (err) {
      throw new Error(err);
    }
    return parseStsPayload(json, fallback);
  }

  const wrapped = json as ApiResult<unknown>;
  if (!isApiResultOk(wrapped)) {
    throw new Error(String(wrapped.m || "获取 STS 失败"));
  }
  return parseStsPayload(wrapped.d, fallback);
}

async function uploadDramaAssetViaSts(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const cfg = readCosUploadConfig();
  const fileName = await buildHashedUploadFileName(file);
  const cosKey = buildCosObjectKey(cfg.keyPrefix, fileName);
  const sts = await fetchCosSts(file, cosKey);

  const cos = new COS({
    SecretId: sts.tmpSecretId,
    SecretKey: sts.tmpSecretKey,
    SecurityToken: sts.sessionToken,
    StartTime: sts.startTime,
    ExpiredTime: sts.expiredTime,
  });

  await new Promise<void>((resolve, reject) => {
    cos.uploadFile(
      {
        Bucket: sts.bucket,
        Region: sts.region,
        Key: sts.key,
        Body: file,
        SliceSize: 1024 * 1024 * 5,
        onProgress(progressData) {
          if (!onProgress) {
            return;
          }
          onProgress(Math.min(100, Math.round((progressData.percent ?? 0) * 100)));
        },
      },
      (err) => {
        if (err) {
          reject(new Error(err.message || "COS 上传失败"));
          return;
        }
        resolve();
      },
    );
  });

  return cosKeyToPublishKey(sts.key);
}

/** Demo 测试：始终 oss/form 直传 */
export function uploadDramaAssetOssFormDemo(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
  return uploadDramaAssetViaOssForm(file, onProgress);
}

/** 浏览器直传 COS，返回 publish 用的文件名 key */
export async function uploadDramaAssetToCos(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const cfg = readCosUploadConfig();
  assertCosUploadConfig(cfg);
  if (cfg.mode === "form") {
    return uploadDramaAssetViaOssForm(file, onProgress);
  }
  return uploadDramaAssetViaSts(file, onProgress);
}
