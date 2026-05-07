const baseURL = import.meta.env.VITE_API_BASE_URL || "https://test.yogoshort.com/api";

/** 与 slot_old `src/api/baseURL.ts` 一致：prefix 以 `/` 结尾 */
export const apiBaseURL = baseURL.endsWith("/") ? baseURL : `${baseURL}/`;
