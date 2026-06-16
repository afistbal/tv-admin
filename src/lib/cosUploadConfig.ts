export type CosUploadMode = "form" | "sts";

export type CosUploadRuntimeConfig = {
  /** true = 直传 COS；false = admin/movie/upload */
  enabled: boolean;
  /** form：GET oss/form + POST；sts：临时密钥 + cos-js-sdk */
  mode: CosUploadMode;
  bucket: string;
  region: string;
  /** COS 对象 Key 前缀，如 add-movies */
  keyPrefix: string;
  /** GET oss/form（带 Bearer） */
  ossFormPath: string;
  stsApiPath: string;
  stsUrl: string;
};

function trimSlashes(s: string): string {
  return s.replace(/^\/+|\/+$/g, "");
}

export function buildCosObjectKey(prefix: string, fileName: string): string {
  const base = trimSlashes(prefix);
  const name = fileName.replace(/^\/+/, "");
  return base ? `${base}/${name}` : name;
}

export function cosKeyToPublishKey(cosKey: string): string {
  const parts = cosKey.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? cosKey;
}

export function readCosUploadConfig(): CosUploadRuntimeConfig {
  const enabled = import.meta.env.VITE_COS_UPLOAD_ENABLED === "1";
  const mode: CosUploadMode = import.meta.env.VITE_COS_UPLOAD_MODE?.trim() === "sts" ? "sts" : "form";
  return {
    enabled,
    mode,
    bucket: import.meta.env.VITE_COS_BUCKET?.trim() ?? "",
    region: import.meta.env.VITE_COS_REGION?.trim() ?? "",
    keyPrefix: import.meta.env.VITE_COS_KEY_PREFIX?.trim() ?? "",
    ossFormPath: import.meta.env.VITE_COS_OSS_FORM_PATH?.trim() || "oss/form",
    stsApiPath: import.meta.env.VITE_COS_STS_API_PATH?.trim() || "admin/movie/cos-sts",
    stsUrl: import.meta.env.VITE_COS_STS_URL?.trim() ?? "",
  };
}

export function assertCosUploadConfig(cfg: CosUploadRuntimeConfig): void {
  if (cfg.mode === "form") {
    if (!cfg.ossFormPath) {
      throw new Error("未配置 OSS form 接口路径");
    }
    return;
  }
  if (!cfg.bucket) {
    throw new Error("未配置 VITE_COS_BUCKET");
  }
  if (!cfg.region) {
    throw new Error("未配置 VITE_COS_REGION");
  }
  if (!cfg.stsUrl && !cfg.stsApiPath) {
    throw new Error("未配置 VITE_COS_STS_URL 或 VITE_COS_STS_API_PATH");
  }
}

export function normalizeCosPostUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("OSS form 缺少上传 url");
  }
  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed.replace(/^\/+/, "")}`;
  }
  return trimmed;
}
