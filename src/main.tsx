import { createRoot } from "react-dom/client";
import { ConfigProvider, App as AntdApp } from "antd";
import zhCN from "antd/locale/zh_CN";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { AppConfigProvider } from "./config/AppConfigContext";
import "./index.css";

/**
 * 本仓库未使用 PWA。若曾在 localhost:5173 跑过 slot_old 等带 SW 的项目，
 * 浏览器会残留 Service Worker 并请求 manifest / @vite-plugin-pwa/*，导致控制台 404。
 */
if (import.meta.env.DEV && "serviceWorker" in navigator) {
  void navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      void registration.unregister();
    }
  });
}

createRoot(document.getElementById("root")!).render(
  <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: "#1677ff" } }}>
    <AntdApp>
      <HashRouter>
        <AuthProvider>
          <AppConfigProvider>
            <App />
          </AppConfigProvider>
        </AuthProvider>
      </HashRouter>
    </AntdApp>
  </ConfigProvider>,
);
