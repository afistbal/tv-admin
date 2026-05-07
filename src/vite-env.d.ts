/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_FLAG?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_PROXY_TARGET?: string;
  readonly VITE_PUBLIC_WEB_ORIGIN?: string;
  /** 影片封面 CDN 根，如 https://xxx 不含末尾斜杠 */
  readonly VITE_STATIC_ASSET_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
