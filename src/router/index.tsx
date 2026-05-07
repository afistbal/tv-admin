import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Spin } from "antd";
import { RequireAuth } from "@/auth/RequireAuth";

const Login = lazy(() => import("@/pages/Login").then((m) => ({ default: m.Login })));
const BasicLayout = lazy(() =>
  import("@/layouts/BasicLayout").then((m) => ({ default: m.BasicLayout })),
);
const Dashboard = lazy(() => import("@/pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const UserList = lazy(() => import("@/pages/UserList").then((m) => ({ default: m.UserList })));
const UserActivity = lazy(() =>
  import("@/pages/UserActivity").then((m) => ({ default: m.UserActivity })),
);
const PromotionSources = lazy(() =>
  import("@/pages/PromotionSources").then((m) => ({ default: m.PromotionSources })),
);
const OrderList = lazy(() => import("@/pages/OrderList").then((m) => ({ default: m.OrderList })));
const MovieList = lazy(() => import("@/pages/MovieList").then((m) => ({ default: m.MovieList })));
const NotFound = lazy(() => import("@/pages/NotFound").then((m) => ({ default: m.NotFound })));

function RouteFallback() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "40vh",
      }}
    >
      <Spin size="large" />
    </div>
  );
}

export function AppRouter() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<BasicLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="users/list" element={<UserList />} />
            <Route path="users/activity/:userId" element={<UserActivity />} />
            <Route path="data/promotion-sources" element={<PromotionSources />} />
            <Route path="data/orders/:orderId" element={<Navigate to="/data/orders" replace />} />
            <Route path="data/orders" element={<OrderList />} />
            <Route path="drama/movies" element={<MovieList />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
