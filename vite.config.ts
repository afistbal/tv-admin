import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/** `npm run build:prod`（`--mode prod`）时静态资源输出目录 */
const PROD_OUT_DIR = "D:/JJ-TV/movie-admin-prod";

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, rootDir, "");
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || "https://test.yogoshort.com";
  const isProdMode = mode === "prod";
  const isBuild = command === "build";

  return {
    plugins: [react()],
    /** 构建阶段去掉 console / 注释，减小体积（开发 serve 不受影响） */
    esbuild: {
      drop: isBuild ? (["console", "debugger"] as const) : [],
      legalComments: "none",
    },
    build: {
      /** 现代浏览器目标，减少不必要的 polyfill 式降级输出 */
      target: "es2020",
      /** esbuild 压缩通常比 terser 更快，对大体积 antd 依赖体积也更稳定 */
      minify: "esbuild",
      cssMinify: true,
      chunkSizeWarningLimit: 1100,
      ...(isProdMode
        ? {
            outDir: PROD_OUT_DIR,
            /** outDir 在本项目根目录之外时必须显式开启 */
            emptyOutDir: true,
          }
        : {}),
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            if (id.includes("firebase")) return "firebase-vendor";
            if (id.includes("react-router")) return "router-vendor";
            if (id.includes("react-dom") || id.includes("/react/") || id.includes("\\react\\")) {
              return "react-vendor";
            }
            if (
              id.includes("antd") ||
              id.includes("@ant-design") ||
              id.includes("/rc-") ||
              id.includes("\\rc-")
            ) {
              return "antd-vendor";
            }
          },
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(rootDir, "src"),
      },
    },
    server: {
      host: "0.0.0.0",
      port: 5173,
      open: true,
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: true,
        },
      },
    },
    preview: {
      host: "0.0.0.0",
      port: 5173,
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: true,
        },
      },
    },
  };
});
