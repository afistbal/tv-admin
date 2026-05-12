/** POST `admin/stat/total`：`daterange` 为 `["Y-m-d","Y-m-d"]`；渠道筛选用 **`keyword`**（与全局请求头 `X-Source`/localStorage `source` 区分）；列表在 `d.data` 或 `d.rows`。 */
export type AdminStatTotalPayload = {
  rows?: AdminStatSummaryRow[];
  /** 部分接口用 data 承载列表 */
  data?: AdminStatSummaryRow[];
  total?: number;
  count?: number;
};

/** `_rowKind` / `_flatDetail` / `_channelNames` 等：接口扁平行由前端聚合成「按日 summary + 各 source detail」子行。 */
export type AdminStatSummaryRow = Record<string, unknown>;
