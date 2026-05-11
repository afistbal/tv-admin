import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "@/auth/RequireAuth";
import { BasicLayout } from "@/layouts/BasicLayout";
import { Dashboard } from "@/pages/Dashboard";
import { DramaLatestUpdate } from "@/pages/DramaLatestUpdate";
import { MovieList } from "@/pages/MovieList";
import { OrderList } from "@/pages/OrderList";
import { PromotionSources } from "@/pages/PromotionSources";
import { SubscriptionUsers } from "@/pages/SubscriptionUsers";
import { SummaryStatistics } from "@/pages/SummaryStatistics";
import { UserActivity } from "@/pages/UserActivity";
import { UserList } from "@/pages/UserList";

/** 登录页单独分包，其余后台页同步引入，避免切换菜单时 lazy + Suspense(null) 造成主区域白屏闪烁 */
const LoginLazy = lazy(() => import("@/pages/Login").then((m) => ({ default: m.Login })));
const NotFound = lazy(() => import("@/pages/NotFound").then((m) => ({ default: m.NotFound })));

export function AppRouter() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <Suspense fallback={null}>
            <LoginLazy />
          </Suspense>
        }
      />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<BasicLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="users/list" element={<UserList />} />
          <Route path="users/activity/:userId" element={<UserActivity />} />
          <Route path="data/promotion-sources" element={<PromotionSources />} />
          <Route path="stats/summary" element={<SummaryStatistics />} />
          <Route path="stats/subscription-users" element={<SubscriptionUsers />} />
          <Route path="data/orders/:orderId" element={<Navigate to="/data/orders" replace />} />
          <Route path="data/orders" element={<OrderList />} />
          <Route path="drama/latest-update" element={<DramaLatestUpdate />} />
          <Route path="drama/movies" element={<MovieList />} />
        </Route>
      </Route>
      <Route
        path="*"
        element={
          <Suspense fallback={null}>
            <NotFound />
          </Suspense>
        }
      />
    </Routes>
  );
}
