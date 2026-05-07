function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * 将 ISO / 日期字符串格式化为 `YYYY-MM-DD HH:mm:ss`（本地时区），含时分秒。
 */
export function formatDateTimeZh(v: string | null | undefined): string {
  if (v == null || v === "") {
    return "—";
  }
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) {
    return String(v);
  }
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}
