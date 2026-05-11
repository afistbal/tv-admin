/** GET/POST `admin/stat/total` 等业务约定：行字段后端可能为 camelCase / snake_case */

export type AdminStatTotalPayload = {
  rows?: AdminStatSummaryRow[];
  /** 部分接口用 data 承载列表 */
  data?: AdminStatSummaryRow[];
  total?: number;
  count?: number;
};

/** `_rowKind`: `summary` 汇总（含单渠道按日列表）；`detail` 子行；`_flatDetail` 树形下扁平行（首列仍显示日期）；`_channelNames` 汇总渠道列表 */
export type AdminStatSummaryRow = Record<string, unknown>;
