import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import getPlacements from "antd/es/_util/placements";
import {
  BarChartOutlined,
  DashboardOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MessageOutlined,
  PieChartOutlined,
  PlaySquareOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Drawer, Dropdown, Layout, Menu, Popover, Space, Tag, Tooltip, theme, Typography } from "antd";
import type { MenuProps } from "antd";
import { MobilePageZoom } from "@/components/MobilePageZoom";
import { MobileZoomViewport } from "@/components/MobileZoomViewport";
import { useAuth } from "@/auth/AuthContext";
import { useMobileH5State } from "@/hooks/useIsMobileH5";
import { usePageZoom } from "@/hooks/usePageZoom";
import { MAIN_CONTENT_SCROLL_ID } from "@/lib/tableSticky";
import styles from "./BasicLayout.module.css";

const { Header, Sider, Content } = Layout;

/** 展开侧栏时保持三个分组常开；用常量避免每次路由变化都 new 数组触发菜单无意义重绘 */
const DEFAULT_SUBMENU_OPEN_KEYS = ["sub-users", "sub-data", "sub-drama", "sub-stats", "sub-chat", "sub-config"] as const;

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
        key: "/data/promotion-list",
        label: <Link to="/data/promotion-list">推广列表</Link>,
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
    children: [
      { key: "/drama/movies", label: <Link to="/drama/movies">剧集列表</Link> },
      { key: "/drama/latest-update", label: <Link to="/drama/latest-update">最新更新</Link> },
    ],
  },
  {
    key: "sub-stats",
    icon: <PieChartOutlined />,
    label: "统计管理",
    children: [
      {
        key: "/stats/summary",
        label: <Link to="/stats/summary">汇总统计</Link>,
      },
      {
        key: "/stats/subscription-users",
        label: <Link to="/stats/subscription-users">订阅用户</Link>,
      },
    ],
  },
  {
    key: "sub-chat",
    icon: <MessageOutlined />,
    label: "聊天管理",
    children: [{ key: "/chat/feedback", label: <Link to="/chat/feedback">需求处理</Link> }],
  },
  {
    key: "sub-config",
    icon: <SettingOutlined />,
    label: "配置管理",
    children: [
      { key: "/config/products", label: <Link to="/config/products">产品管理</Link> },
      { key: "/config/recommend-pool", label: <Link to="/config/recommend-pool">推荐管理</Link> },
    ],
  },
];

/** 折叠侧栏专用：Popover 内用 Link，避免 hover 浮层提前关掉时 Button 的 click 丢失；与 HashRouter 一致 */
function CollapsedPopoverLinks({ links }: { links: readonly { to: string; label: ReactNode }[] }) {
  return (
    <div className={styles.collapsedPopoverPanel} onMouseDown={(e) => e.stopPropagation()}>
      {links.map((it) => (
        <Link key={it.to} to={it.to} className={styles.collapsedPopoverEntry} onClick={(e) => e.stopPropagation()}>
          {it.label}
        </Link>
      ))}
    </div>
  );
}

function CollapsedSideNav({ pathname }: { pathname: string }) {
  const { token } = theme.useToken();

  /** 比默认多一段水平偏移，浮层整体再往右靠一点（rightTop 时增大 offset[0]） */
  const builtinPlacements = useMemo(
    () =>
      getPlacements({
        arrowPointAtCenter: false,
        autoAdjustOverflow: true,
        arrowWidth: token.sizePopupArrow,
        borderRadius: token.borderRadius,
        offset: token.marginXXS + 14,
        visibleFirst: true,
      }),
    [token.borderRadius, token.marginXXS, token.sizePopupArrow],
  );

  const dashboardActive = pathname.startsWith("/dashboard");
  const usersActive = pathname.startsWith("/users");
  const dataActive = pathname.startsWith("/data");
  const dramaActive = pathname.startsWith("/drama");
  const statsActive = pathname.startsWith("/stats");
  const chatActive = pathname.startsWith("/chat");
  const configActive = pathname.startsWith("/config");

  /**
   * color=#001529：面板与小箭头同色（antd 会给箭头设 --antd-arrow-background-color）
   * builtinPlacements：额外右偏，避免贴侧栏太近
   */
  const popCommon = {
    placement: "rightTop" as const,
    trigger: "hover" as const,
    mouseEnterDelay: 0,
    mouseLeaveDelay: 0.14,
    arrow: true,
    /** 深色气泡 + 深色箭头，避免默认白箭头 */
    color: "#001529",
    builtinPlacements,
    getPopupContainer: () => document.body,
    overlayStyle: { zIndex: 3100 },
    classNames: { root: styles.collapsedPopoverRoot },
    overlayInnerStyle: {
      padding: 0,
      background: "transparent",
      boxShadow: "none",
    },
  };

  return (
    <nav className={styles.collapsedNav} data-admin-collapsed-nav="1" aria-label="主导航">
      <Tooltip title="仪表盘" placement="right">
        <Link
          to="/dashboard"
          className={`${styles.collapsedIconBtn} ${dashboardActive ? styles.collapsedIconBtnActive : ""}`}
        >
          <DashboardOutlined />
        </Link>
      </Tooltip>

      <Popover {...popCommon} content={<CollapsedPopoverLinks links={[{ to: "/users/list", label: "用户列表" }]} />}>
        <div
          className={`${styles.collapsedIconBtn} ${usersActive ? styles.collapsedIconBtnActive : ""}`}
          role="button"
          tabIndex={0}
          aria-label="用户管理"
        >
          <TeamOutlined />
        </div>
      </Popover>

      <Popover
        {...popCommon}
        content={
          <CollapsedPopoverLinks
            links={[
              { to: "/data/promotion-sources", label: "推广来源" },
              { to: "/data/promotion-list", label: "推广列表" },
              { to: "/data/orders", label: "代收记录" },
            ]}
          />
        }
      >
        <div
          className={`${styles.collapsedIconBtn} ${dataActive ? styles.collapsedIconBtnActive : ""}`}
          role="button"
          tabIndex={0}
          aria-label="数据管理"
        >
          <BarChartOutlined />
        </div>
      </Popover>

      <Popover
        {...popCommon}
        content={
          <CollapsedPopoverLinks
            links={[
              { to: "/drama/movies", label: "剧集列表" },
              { to: "/drama/latest-update", label: "最新更新" },
            ]}
          />
        }
      >
        <div
          className={`${styles.collapsedIconBtn} ${dramaActive ? styles.collapsedIconBtnActive : ""}`}
          role="button"
          tabIndex={0}
          aria-label="短剧管理"
        >
          <PlaySquareOutlined />
        </div>
      </Popover>

      <Popover
        {...popCommon}
        content={
          <CollapsedPopoverLinks
            links={[
              { to: "/stats/summary", label: "汇总统计" },
              { to: "/stats/subscription-users", label: "订阅用户" },
            ]}
          />
        }
      >
        <div
          className={`${styles.collapsedIconBtn} ${statsActive ? styles.collapsedIconBtnActive : ""}`}
          role="button"
          tabIndex={0}
          aria-label="统计管理"
        >
          <PieChartOutlined />
        </div>
      </Popover>

      <Popover
        {...popCommon}
        content={<CollapsedPopoverLinks links={[{ to: "/chat/feedback", label: "需求处理" }]} />}
      >
        <div
          className={`${styles.collapsedIconBtn} ${chatActive ? styles.collapsedIconBtnActive : ""}`}
          role="button"
          tabIndex={0}
          aria-label="聊天管理"
        >
          <MessageOutlined />
        </div>
      </Popover>

      <Popover
        {...popCommon}
        content={
          <CollapsedPopoverLinks
            links={[
              { to: "/config/products", label: "产品管理" },
              { to: "/config/recommend-pool", label: "推荐管理" },
            ]}
          />
        }
      >
        <div
          className={`${styles.collapsedIconBtn} ${configActive ? styles.collapsedIconBtnActive : ""}`}
          role="button"
          tabIndex={0}
          aria-label="配置管理"
        >
          <SettingOutlined />
        </div>
      </Popover>
    </nav>
  );
}

function SideMenu(props: {
  selectedKeys: string[];
  openKeys: string[];
  onOpenChange: (keys: string[]) => void;
  onNavigate?: () => void;
}) {
  const { selectedKeys, openKeys, onOpenChange, onNavigate } = props;
  return (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={selectedKeys}
      openKeys={openKeys}
      onOpenChange={onOpenChange}
      items={menuItems}
      onClick={onNavigate}
    />
  );
}

export function BasicLayout() {
  const { isMobile, isLandscapePhone } = useMobileH5State();
  const pageZoom = usePageZoom();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [openKeys, setOpenKeys] = useState<string[]>(() => [...DEFAULT_SUBMENU_OPEN_KEYS]);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  /** 切换路由后仍保持各一级分组默认展开（pathname 变化时若已是展开态则不重复 set，减轻菜单闪动） */
  useEffect(() => {
    if (collapsed || isMobile) {
      return;
    }
    setOpenKeys((prev) => {
      if (
        prev.length === DEFAULT_SUBMENU_OPEN_KEYS.length &&
        DEFAULT_SUBMENU_OPEN_KEYS.every((k, i) => prev[i] === k)
      ) {
        return prev;
      }
      return [...DEFAULT_SUBMENU_OPEN_KEYS];
    });
  }, [location.pathname, collapsed, isMobile]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (isMobile) {
      setCollapsed(true);
    }
  }, [isMobile]);

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
    if (location.pathname.startsWith("/drama/latest-update")) {
      return ["/drama/latest-update"];
    }
    if (location.pathname.startsWith("/drama/movies")) {
      return ["/drama/movies"];
    }
    if (location.pathname.startsWith("/data/orders")) {
      return ["/data/orders"];
    }
    if (location.pathname.startsWith("/data/promotion-list")) {
      return ["/data/promotion-list"];
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
    if (location.pathname.startsWith("/stats/subscription-users")) {
      return ["/stats/subscription-users"];
    }
    if (location.pathname.startsWith("/stats/summary")) {
      return ["/stats/summary"];
    }
    if (location.pathname.startsWith("/chat/feedback")) {
      return ["/chat/feedback"];
    }
    if (location.pathname.startsWith("/config/recommend-pool")) {
      return ["/config/recommend-pool"];
    }
    if (location.pathname.startsWith("/config/products")) {
      return ["/config/products"];
    }
    return [];
  }, [location.pathname]);

  const closeMobileNav = () => setMobileNavOpen(false);

  const zoomControls = (theme: "light" | "dark" = "light") => (
    <MobilePageZoom
      theme={theme}
      zoom={pageZoom.zoom}
      canDecrease={pageZoom.canDecrease}
      canIncrease={pageZoom.canIncrease}
      onDecrease={pageZoom.decrease}
      onIncrease={pageZoom.increase}
      onReset={pageZoom.reset}
    />
  );

  const mainPanel = (
    <>
      <Header
        className={styles.header}
        style={{
          padding: isMobile ? "0 12px" : "0 16px",
          background: colorBgContainer,
          display: "flex",
          alignItems: "center",
          gap: isMobile ? 8 : 12,
        }}
      >
        {isMobile ? (
          <MenuUnfoldOutlined className={styles.menuTrigger} onClick={() => setMobileNavOpen(true)} />
        ) : collapsed ? (
          <MenuUnfoldOutlined className={styles.menuTrigger} onClick={() => setCollapsed(false)} />
        ) : (
          <MenuFoldOutlined className={styles.menuTrigger} onClick={() => setCollapsed(true)} />
        )}
        <Typography.Text type="secondary" className={styles.headerWelcome} style={{ flex: 1 }}>
          欢迎回来{user?.name ? `，${String(user.name)}` : ""}
        </Typography.Text>
        <Space size={isMobile ? "small" : "middle"} className={styles.headerActions}>
          {!isMobile ? <Tag color="blue">管理员</Tag> : null}
          <Dropdown
            menu={{ items: userMenu }}
            placement="bottomRight"
            dropdownRender={(menu) => (
              <div className={styles.userDropdownPanel}>
                {menu}
                {isMobile ? (
                  <div className={styles.userMenuZoom}>
                    <Typography.Text type="secondary" className={styles.userMenuZoomLabel}>
                      页面缩放
                    </Typography.Text>
                    {zoomControls("light")}
                  </div>
                ) : null}
              </div>
            )}
          >
            <Space style={{ cursor: "pointer" }} className={styles.headerUser}>
              <UserOutlined />
              <Typography.Text className={styles.headerUserName}>
                {user?.name ?? user?.email ?? "账号"}
              </Typography.Text>
            </Space>
          </Dropdown>
        </Space>
      </Header>
      <Content id={MAIN_CONTENT_SCROLL_ID} className={styles.content}>
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
    </>
  );

  const mobileDrawerWidth = isLandscapePhone
    ? Math.min(320, typeof window !== "undefined" ? Math.round(window.innerWidth * 0.42) : 320)
    : Math.min(280, typeof window !== "undefined" ? Math.round(window.innerWidth * 0.82) : 280);

  return (
    <Layout
      className={isLandscapePhone ? `${styles.root} ${styles.rootLandscapePhone}` : styles.root}
      style={{ background: "#ffffff" }}
    >
      {isMobile ? (
        <Drawer
          className={styles.mobileNavDrawer}
          placement="left"
          open={mobileNavOpen}
          onClose={closeMobileNav}
          width={mobileDrawerWidth}
          styles={{
            body: {
              padding: 0,
              background: "#001529",
              display: "flex",
              flexDirection: "column",
              height: "100%",
            },
          }}
          title={
            <Typography.Title level={5} style={{ color: "#fff", margin: 0 }}>
              TV 管理后台
            </Typography.Title>
          }
        >
          <div className={styles.mobileNavMenu}>
            <SideMenu
              selectedKeys={selectedKeys}
              openKeys={openKeys}
              onOpenChange={setOpenKeys}
              onNavigate={closeMobileNav}
            />
          </div>
        </Drawer>
      ) : (
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
            {collapsed ? (
              <CollapsedSideNav pathname={location.pathname} />
            ) : (
              <SideMenu selectedKeys={selectedKeys} openKeys={openKeys} onOpenChange={setOpenKeys} />
            )}
          </div>
        </Sider>
      )}
      <Layout className={styles.right} style={{ background: "#ffffff" }}>
        {isMobile ? (
          <MobileZoomViewport zoom={pageZoom.zoom}>{mainPanel}</MobileZoomViewport>
        ) : (
          mainPanel
        )}
      </Layout>
    </Layout>
  );
}
