import { createRoot } from "react-dom/client";
import { ConfigProvider, App as AntdApp } from "antd";
import zhCN from "antd/locale/zh_CN";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { AppConfigProvider } from "./config/AppConfigContext";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: "#1677ff" } }}>
    <AntdApp>
      <BrowserRouter>
        <AuthProvider>
          <AppConfigProvider>
            <App />
          </AppConfigProvider>
        </AuthProvider>
      </BrowserRouter>
    </AntdApp>
  </ConfigProvider>,
);
