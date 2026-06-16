/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_FLAG?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_PROXY_TARGET?: string;
  readonly VITE_PUBLIC_WEB_ORIGIN?: string;
  /** 影片封面 CDN 根，如 https://xxx 不含末尾斜杠 */
  readonly VITE_STATIC_ASSET_ORIGIN?: string;
  readonly VITE_COS_UPLOAD_ENABLED?: string;
  /** 存储桶，如 examplebucket-1250000000 */
  readonly VITE_COS_BUCKET?: string;
  /** 地域，如 ap-guangzhou */
  readonly VITE_COS_REGION?: string;
  /** COS 对象 Key 前缀目录，如 movie_assets/dev */
  readonly VITE_COS_KEY_PREFIX?: string;
  /** 业务 STS 接口路径（相对 API），默认 admin/movie/cos-sts */
  readonly VITE_COS_STS_API_PATH?: string;
  /** 独立 STS 服务完整 URL（优先于 STS_API_PATH） */
  readonly VITE_COS_STS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
