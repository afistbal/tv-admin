const TOKEN_KEY = "token";

/** 与 slot 一致：读 localStorage.token，形如 `433|IDTdA34...` */
export function getAuthToken(): string {
  return localStorage.getItem(TOKEN_KEY)?.trim() ?? "";
}
