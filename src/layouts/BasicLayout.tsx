import { useMemo, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
  DashboardOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from "@ant-design/icons";
import { Layout, Menu, theme, Typography } from "antd";

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: "/dashboard", icon: <DashboardOutlined />, label: <Link to="/dashboard">工作台</Link> },
];

export function BasicLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const selectedKeys = useMemo(() => {
    const hit = menuItems.find((i) => location.pathname.startsWith(i.key));
    return hit ? [hit.key] : [];
  }, [location.pathname]);

  return (
    <Layout style={{ minHeight: "100%" }}>
      <Sider trigger={null} collapsible collapsed={collapsed} theme="dark">
        <div
          style={{
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            padding: collapsed ? 0 : "0 20px",
          }}
        >
          <Typography.Title level={4} style={{ color: "#fff", margin: 0, whiteSpace: "nowrap" }}>
            {collapsed ? "TV" : "TV 管理后台"}
          </Typography.Title>
        </div>
        <Menu theme="dark" mode="inline" selectedKeys={selectedKeys} items={menuItems} />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: "0 16px",
            background: colorBgContainer,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          {collapsed ? (
            <MenuUnfoldOutlined style={{ fontSize: 18 }} onClick={() => setCollapsed(false)} />
          ) : (
            <MenuFoldOutlined style={{ fontSize: 18 }} onClick={() => setCollapsed(true)} />
          )}
          <Typography.Text type="secondary">欢迎回来</Typography.Text>
        </Header>
        <Content style={{ margin: 16 }}>
          <div
            style={{
              padding: 24,
              minHeight: 360,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
            }}
          >
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
