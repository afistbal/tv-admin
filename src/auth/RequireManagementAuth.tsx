import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useManagementAuth } from "./ManagementAuthContext";

export function RequireManagementAuth() {
  const { authenticated } = useManagementAuth();
  const location = useLocation();

  if (!authenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname, backend: "management" }}
      />
    );
  }

  return <Outlet />;
}
