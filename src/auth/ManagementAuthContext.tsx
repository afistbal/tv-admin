import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  clearManagementToken,
  getManagementToken,
  isManagementApiSuccess,
  managementPost,
  setManagementToken,
} from "@/api/managementClient";

const MANAGEMENT_USER_KEY = "tv-admin-management-user";

export type ManagementUser = {
  token?: string;
  userName?: string;
  nickName?: string;
  cellPhone?: string;
  [key: string]: unknown;
};

type ManagementLoginResult = { ok: true } | { ok: false; message: string };

type ManagementAuthState = {
  user: ManagementUser | null;
  authenticated: boolean;
  login: (account: string, password: string) => Promise<ManagementLoginResult>;
  logout: () => void;
};

const ManagementAuthContext = createContext<ManagementAuthState | null>(null);

function readStoredUser(): ManagementUser | null {
  try {
    if (!getManagementToken()) return null;
    const raw = localStorage.getItem(MANAGEMENT_USER_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed != null && typeof parsed === "object" ? (parsed as ManagementUser) : {};
  } catch {
    return null;
  }
}

export function ManagementAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ManagementUser | null>(readStoredUser);

  const login = useCallback(async (account: string, password: string): Promise<ManagementLoginResult> => {
    const cellPhone = account.trim();
    if (!cellPhone || !password) {
      return { ok: false, message: "请输入账号和密码" };
    }
    try {
      const result = await managementPost<ManagementUser>(
        "ad/user/login",
        { cellPhone, password },
        { authenticated: false },
      );
      if (!isManagementApiSuccess(result.code)) {
        return { ok: false, message: result.message || "登录失败" };
      }
      const nextUser = result.data && typeof result.data === "object" ? result.data : {};
      const token = typeof nextUser.token === "string" ? nextUser.token.trim() : "";
      if (!token) {
        return { ok: false, message: "登录响应缺少 token" };
      }
      setManagementToken(token);
      localStorage.setItem(MANAGEMENT_USER_KEY, JSON.stringify(nextUser));
      setUser(nextUser);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error && error.message ? error.message : "网络异常，请稍后重试",
      };
    }
  }, []);

  const logout = useCallback(() => {
    clearManagementToken();
    localStorage.removeItem(MANAGEMENT_USER_KEY);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, authenticated: Boolean(user && getManagementToken()), login, logout }),
    [user, login, logout],
  );

  return <ManagementAuthContext.Provider value={value}>{children}</ManagementAuthContext.Provider>;
}

export function useManagementAuth(): ManagementAuthState {
  const context = useContext(ManagementAuthContext);
  if (!context) {
    throw new Error("useManagementAuth must be used within ManagementAuthProvider");
  }
  return context;
}
