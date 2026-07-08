/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_FLAG?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_PROXY_TARGET?: string;
  readonly VITE_PUBLIC_WEB_ORIGIN?: string;
  readonly VITE_SITE_MAIN_LABEL?: string;
  readonly VITE_SITE_MAIN_API_BASE_URL?: string;
  readonly VITE_SITE_MAIN_PUBLIC_WEB_ORIGIN?: string;
  readonly VITE_SITE_PROD1_LABEL?: string;
  readonly VITE_SITE_PROD1_API_BASE_URL?: string;
  readonly VITE_SITE_PROD1_PUBLIC_WEB_ORIGIN?: string;
  /** 影片封面 CDN 根，如 https://xxx 不含末尾斜杠 */
  readonly VITE_STATIC_ASSET_ORIGIN?: string;
  readonly VITE_COS_UPLOAD_ENABLED?: string;
  /** 存储桶，如 examplebucket-1250000000 */
  readonly VITE_COS_BUCKET?: string;
  /** 地域，如 ap-guangzhou */
  readonly VITE_COS_REGION?: string;
  /** COS 对象 Key 前缀目录，如 movie_assets/dev */
  readonly VITE_COS_KEY_PREFIX?: string;
  /** COS 公网访问根（预览 add-movies 视频），默认 https://cos.yogoshort.com */
  readonly VITE_COS_PUBLIC_BASE?: string;
  /** 业务 STS 接口路径（相对 API），默认 admin/movie/cos-sts */
  readonly VITE_COS_STS_API_PATH?: string;
  /** 独立 STS 服务完整 URL（优先于 STS_API_PATH） */
  readonly VITE_COS_STS_URL?: string;
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
