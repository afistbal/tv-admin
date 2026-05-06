import { Navigate, Route, Routes } from "react-router-dom";
import { BasicLayout } from "@/layouts/BasicLayout";
import { Dashboard } from "@/pages/Dashboard";
import { NotFound } from "@/pages/NotFound";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<BasicLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
