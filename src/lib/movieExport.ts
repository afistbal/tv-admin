import { message } from "antd";
import { apiGet } from "@/api/client";
import type { ApiResult } from "@/api/types";

/** `GET admin/movie/export?id=` → 下载 `{id}.txt`，与剧集列表导出一致 */
export async function downloadMovieExportTxt(movieId: number): Promise<boolean> {
  try {
    const res: ApiResult<string> = await apiGet<string>("admin/movie/export", { id: movieId });
    if (res.c !== 0) {
      message.error(res.m || "导出失败");
      return false;
    }
    const text = res.d != null ? String(res.d) : "";
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain; charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${movieId}.txt`;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    message.success("已开始下载");
    return true;
  } catch {
    message.error("网络异常");
    return false;
  }
}
