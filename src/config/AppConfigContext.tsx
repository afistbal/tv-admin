import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiGet } from "@/api/client";
import type { ApiResult } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";

type AppConfigPayload = Record<string, unknown>;

const AppStaticContext = createContext<string | null>(null);

function normalizeStaticBase(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const s = raw.trim();
  if (!s) {
    return null;
  }
  return s.replace(/\/+$/, "");
}

/**
 * 登录后拉取与 slot 一致的 `GET config`，将 `d.static` 提供给封面等静态资源拼接（`static` + `/` + `image` 文件名）。
 */
export function AppConfigProvider({ children }: { children: ReactNode }) {
  const { user, bootstrapping } = useAuth();
  const [staticBase, setStaticBase] = useState<string | null>(null);

  useEffect(() => {
    if (bootstrapping || !user) {
      if (!user) {
        setStaticBase(null);
      }
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res: ApiResult<AppConfigPayload> = await apiGet<AppConfigPayload>("config");
        if (cancelled) {
          return;
        }
        if (res.c !== 0) {
          setStaticBase(null);
          return;
        }
        setStaticBase(normalizeStaticBase(res.d?.["static"]));
      } catch {
        if (!cancelled) {
          setStaticBase(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, bootstrapping]);

  return <AppStaticContext.Provider value={staticBase}>{children}</AppStaticContext.Provider>;
}

/** `config.d.static`，未拉到前为 `null` */
export function useAppStaticBase(): string | null {
  return useContext(AppStaticContext);
}
