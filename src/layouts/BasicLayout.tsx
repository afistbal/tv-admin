import { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChartOutlined,
  DashboardOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlaySquareOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Dropdown, Layout, Menu, Space, Tag, theme, Typography } from "antd";
import type { MenuProps } from "antd";
import { useAuth } from "@/auth/AuthContext";
import styles from "./BasicLayout.module.css";

const { Header, Sider, Content } = Layout;

const menuItems: MenuProps["items"] = [
  { key: "/dashboard", icon: <DashboardOutlined />, label: <Link to="/dashboard">仪表盘</Link> },
  {
    key: "sub-users",
    icon: <TeamOutlined />,
    label: "用户管理",
    children: [{ key: "/users/list", label: <Link to="/users/list">用户列表</Link> }],
  },
  {
    key: "sub-data",
    icon: <BarChartOutlined />,
    label: "数据管理",
    children: [
      {
        key: "/data/promotion-sources",
        label: <Link to="/data/promotion-sources">推广来源</Link>,
      },
      {
        key: "/data/orders",
        label: <Link to="/data/orders">代收记录</Link>,
      },
    ],
  },
  {
    key: "sub-drama",
    icon: <PlaySquareOutlined />,
    label: "短剧管理",
    children: [{ key: "/drama/movies", label: <Link to="/drama/movies">影片列表</Link> }],
  },
];

export function BasicLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [openKeys, setOpenKeys] = useState<string[]>(["sub-users", "sub-data", "sub-drama"]);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  /** 切换路由后仍保持各一级分组默认展开 */
  useEffect(() => {
    if (!collapsed) {
      setOpenKeys(["sub-users", "sub-data", "sub-drama"]);
    }
  }, [location.pathname, collapsed]);

  const userMenu: MenuProps["items"] = [
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "退出登录",
      onClick: () => {
        logout();
        navigate("/login", { replace: true });
      },
    },
  ];

  const selectedKeys = useMemo(() => {
    if (location.pathname.startsWith("/drama/movies")) {
      return ["/drama/movies"];
    }
    if (location.pathname.startsWith("/data/orders")) {
      return ["/data/orders"];
    }
    if (location.pathname.startsWith("/data/promotion-sources")) {
      return ["/data/promotion-sources"];
    }
    if (location.pathname.startsWith("/users")) {
      return ["/users/list"];
    }
    if (location.pathname.startsWith("/dashboard")) {
      return ["/dashboard"];
    }
    return [];
  }, [location.pathname]);

  return (
    <Layout className={styles.root} style={{ background: "#ffffff" }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        theme="dark"
        className={styles.sider}
      >
        <div
          className={styles.siderBrand}
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
        <div className={styles.siderMenuScroll}>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={selectedKeys}
            openKeys={collapsed ? [] : openKeys}
            onOpenChange={setOpenKeys}
            items={menuItems}
          />
        </div>
      </Sider>
      <Layout className={styles.right} style={{ background: "#ffffff" }}>
        <Header
          className={styles.header}
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
          <Typography.Text type="secondary" style={{ flex: 1 }}>
            欢迎回来{user?.name ? `，${String(user.name)}` : ""}
          </Typography.Text>
          <Space size="middle">
            <Tag color="blue">管理员</Tag>
            <Dropdown menu={{ items: userMenu }} placement="bottomRight">
              <Space style={{ cursor: "pointer" }}>
                <UserOutlined />
                <Typography.Text>{user?.name ?? user?.email ?? "账号"}</Typography.Text>
              </Space>
            </Dropdown>
          </Space>
        </Header>
        <Content className={styles.content}>
          <div
            className={styles.contentInner}
            style={{
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
