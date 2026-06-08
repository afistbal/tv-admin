import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getAuthToken } from "@/api/authToken";
import { apiPostJson } from "@/api/client";
import { fetchLoginTokenOutcome, type LoginTokenFetchOutcome } from "@/api/loginToken";
import { auth } from "@/firebase";
import { isAdminUser, normalizeLoginUser, type UserInfo } from "./userInfo";

export type AuthLoginResult = { ok: true } | { ok: false; message: string };

type AuthState = {
  user: UserInfo | null;
  bootstrapping: boolean;
  /** 用当前 localStorage.token 再调一次 login/token（不切换 bootstrapping） */
  revalidateSession: () => Promise<void>;
  loginWithToken: (token: string) => Promise<AuthLoginResult>;
  loginWithEmailCode: (email: string, code: string) => Promise<AuthLoginResult>;
  loginWithGooglePopup: () => Promise<AuthLoginResult>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

const TOKEN_KEY = "token";

function resolveSessionToken(fallbackToken: string, d: Record<string, unknown>): string {
  const t = d.token;
  if (typeof t === "string" && t.length > 0) {
    return t;
  }
  return fallbackToken;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);

  const applySession = useCallback((fallbackToken: string, d: Record<string, unknown>): AuthLoginResult => {
    const info = normalizeLoginUser(d);
    const token = resolveSessionToken(fallbackToken, d);
    if (!token) {
      return { ok: false as const, message: "登录响应缺少 token" };
    }
    if (!isAdminUser(info)) {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
      return { ok: false as const, message: "当前账号不是管理员，无法进入后台" };
    }
    localStorage.setItem(TOKEN_KEY, token);
    setUser(info);
    return { ok: true as const };
  }, []);

  const applyLoginTokenOutcome = useCallback(
    (storedToken: string, outcome: LoginTokenFetchOutcome) => {
      if (outcome.kind !== "ok") {
        /* 网络异常或非 JSON：不删 token，与 slot 侧「保留会话再试」一致 */
        setUser(null);
        return;
      }
      const result = outcome.result;
      if (result.c === 0) {
        const next = applySession(storedToken, result.d as Record<string, unknown>);
        if (!next.ok) {
          setUser(null);
        }
      } else {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
      }
    },
    [applySession],
  );

  const loadFromStoredToken = useCallback(async (signal?: AbortSignal) => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      return;
    }
    const outcome = await fetchLoginTokenOutcome(token, signal);
    if (signal?.aborted || outcome.kind === "aborted") {
      return;
    }
    applyLoginTokenOutcome(token, outcome);
  }, [applyLoginTokenOutcome]);

  const revalidateSession = useCallback(async () => {
    await loadFromStoredToken();
  }, [loadFromStoredToken]);

  /** StrictMode 开发环境会重复执行 effect；中止上一轮 fetch，避免 login/token 连续两次真正完成 */
  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      try {
        await loadFromStoredToken(ac.signal);
      } finally {
        if (!ac.signal.aborted) {
          setBootstrapping(false);
        }
      }
    })();
    return () => ac.abort();
  }, [loadFromStoredToken]);

  const loginWithToken = useCallback(
    async (inputToken: string) => {
      const trimmed = inputToken.trim();
      if (!trimmed) {
        return { ok: false as const, message: "请输入 Token" };
      }
      try {
        const outcome = await fetchLoginTokenOutcome(trimmed);
        if (outcome.kind !== "ok") {
          return { ok: false as const, message: "网络异常，请稍后重试" };
        }
        const result = outcome.result;
        if (result.c !== 0) {
          return { ok: false as const, message: result.m || "登录失败" };
        }
        return applySession(trimmed, result.d as Record<string, unknown>);
      } catch {
        return { ok: false as const, message: "网络异常，请稍后重试" };
      }
    },
    [applySession],
  );

  const loginWithEmailCode = useCallback(
    async (email: string, code: string) => {
      const em = email.trim();
      const co = code.trim();
      if (!em || !co) {
        return { ok: false as const, message: "请填写邮箱与验证码" };
      }
      try {
        const result = await apiPostJson<Record<string, unknown>>("login/email", {
          email: em,
          code: co,
        });
        if (result.c !== 0) {
          return { ok: false as const, message: result.m || "登录失败" };
        }
        const d = result.d as Record<string, unknown>;
        const applied = applySession("", d);
        if (!applied.ok) {
          return applied;
        }
        localStorage.setItem("email", em);
        localStorage.setItem("login-method", "email");
        localStorage.removeItem("user-avatar");
        return { ok: true as const };
      } catch {
        return { ok: false as const, message: "网络异常，请稍后重试" };
      }
    },
    [applySession],
  );

  const loginWithGooglePopup = useCallback(async () => {
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(cred);
      const fbUser = cred.user;
      if (!credential || !fbUser) {
        await signOut(auth).catch(() => {});
        return { ok: false as const, message: "Google 登录未完成" };
      }

      const result = await apiPostJson<Record<string, unknown>>("login/uid", {
        uid: fbUser.uid,
        anonymous: fbUser.isAnonymous ? 1 : 0,
        name: fbUser.displayName || "",
        email: fbUser.email,
        provider: "google",
      });

      if (result.c !== 0) {
        await signOut(auth).catch(() => {});
        return { ok: false as const, message: result.m || "登录失败" };
      }

      const d = result.d as Record<string, unknown>;
      const baseInfo: Record<string, unknown> = {
        ...((d.info as Record<string, unknown>) ?? {}),
      };
      baseInfo.name = fbUser.displayName || String(baseInfo.name ?? "No Name");
      baseInfo.avatar = fbUser.photoURL || String(baseInfo.avatar ?? "");
      baseInfo.email = fbUser.email || String(baseInfo.email ?? "");
      baseInfo.anonymous = fbUser.isAnonymous ? 1 : 0;

      const merged: Record<string, unknown> = { ...d, info: baseInfo };
      const applied = applySession("", merged);
      if (!applied.ok) {
        await signOut(auth).catch(() => {});
        return applied;
      }

      if (fbUser.photoURL) {
        localStorage.setItem("user-avatar", fbUser.photoURL);
      } else {
        localStorage.removeItem("user-avatar");
      }
      localStorage.setItem("login-method", "google");
      return { ok: true as const };
    } catch (e) {
      await signOut(auth).catch(() => {});
      const msg = e instanceof Error ? e.message : "Google 登录失败";
      return { ok: false as const, message: msg };
    }
  }, [applySession]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    void signOut(auth).catch(() => {});
  }, []);

  const value = useMemo(
    () => ({
      user,
      bootstrapping,
      revalidateSession,
      loginWithToken,
      loginWithEmailCode,
      loginWithGooglePopup,
      logout,
    }),
    [user, bootstrapping, revalidateSession, loginWithToken, loginWithEmailCode, loginWithGooglePopup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
