import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type Key,
  type MouseEvent,
} from "react";
import { DownOutlined, UpOutlined } from "@ant-design/icons";
import { Button, DatePicker, Grid, Input, Space, Table, Tooltip, Typography, message } from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import type { ColumnsType } from "antd/es/table";
import { apiPostJson } from "@/api/client";
import { getActiveAdminSite } from "@/api/baseURL";
import type { ApiResult } from "@/api/types";
import type { AdminStatSummaryRow, AdminStatTotalPayload } from "@/types/adminStatSummary";
import { mainContentTableSticky } from "@/lib/tableSticky";
import stylesToolbar from "./UserList.module.css";
import styles from "./SummaryStatistics.module.css";

/** 默认恰好 3 个自然日：今日往前共 3 天 → 起 = 今日-2 的 00:00，止 = 今日 23:59 */
function defaultRange(): [Dayjs, Dayjs] {
  const end = dayjs().endOf("day");
  const start = dayjs().subtract(2, "day").startOf("day");
  return [start, end];
}

/** `admin/stat/total`（POST）：`daterange` 为 `[Y-m-d, Y-m-d]`（`YYYY-MM-DD`），不含时分秒 */
function rangeToStatTotalDaterange(range: [Dayjs, Dayjs]): [string, string] {
  let a = range[0].startOf("day");
  let b = range[1].startOf("day");
  if (a.isAfter(b)) {
    const t = a;
    a = b;
    b = t;
  }
  return [a.format("YYYY-MM-DD"), b.format("YYYY-MM-DD")];
}

function pickStr(row: AdminStatSummaryRow, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      return String(v);
    }
  }
  return "—";
}

/** 树形里的子行（日期跟在父行）：隐藏首列日期；`_flatDetail` 为 true 时扁平行仍显示日期 */
function isNestedTreeDetail(row: AdminStatSummaryRow): boolean {
  return row._rowKind === "detail" && row._flatDetail !== true;
}

function channelNamesFromRow(row: AdminStatSummaryRow): string[] {
  const pref = row._channelNames;
  if (Array.isArray(pref)) {
    const names: string[] = [];
    for (const x of pref) {
      if (typeof x === "string" && x.trim() !== "") {
        names.push(x.trim());
      }
    }
    if (names.length > 0) {
      return names;
    }
  }
  const raw = row.children;
  if (!Array.isArray(raw)) {
    return [];
  }
  const names: string[] = [];
  for (const c of raw) {
    if (c != null && typeof c === "object") {
      const o = c as AdminStatSummaryRow;
      const n = String(o.packageName ?? o.package_name ?? o.channel ?? o.source ?? "").trim();
      if (n) {
        names.push(n);
      }
    }
  }
  return names;
}

/** 与 Table `rowKey` 一致，供受控展开用 */
function tableRowKey(row: AdminStatSummaryRow): string {
  return String(
    row.key ?? `${pickStr(row, ["theDate", "the_date", "stat_date", "date", "statDate"])}_${pickStr(row, ["packageName", "package_name", "channel", "source"])}`,
  );
}

/** 汇总 #fafafa / 子行 #f0f7ff：每格内联背景，避免 antd 默认底纹盖住渠道行 */
function cellBg(record: AdminStatSummaryRow): CSSProperties {
  if (record._rowKind === "detail") {
    return { background: "#f0f7ff", backgroundColor: "#f0f7ff" };
  }
  return { background: "#fafafa", backgroundColor: "#fafafa" };
}

/** 树表根级：带 children 的父行默认全部展开 */
function defaultExpandedParentKeys(data: AdminStatSummaryRow[]): Key[] {
  return data
    .filter((r) => Array.isArray(r.children) && (r.children as AdminStatSummaryRow[]).length > 0)
    .map((r) => tableRowKey(r));
}

function pickNum(row: AdminStatSummaryRow, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v === undefined || v === null || v === "") {
      continue;
    }
    const n = Number(v);
    if (Number.isFinite(n)) {
      return Number.isInteger(n) ? String(n) : n.toFixed(2);
    }
    return String(v);
  }
  return "—";
}

function pickNumValue(row: AdminStatSummaryRow, keys: string[]): number | null {
  for (const k of keys) {
    const v = row[k];
    if (v === undefined || v === null || v === "") {
      continue;
    }
    const n = Number(v);
    if (Number.isFinite(n)) {
      return n;
    }
  }
  return null;
}

const NEW_REG_FIELD_KEYS = [
  "newRegister",
  "new_register",
  "regPerson",
  "reg_person",
  "new_reg",
  "reg_count",
] as const;

const RETENTION_FIELD_KEYS = [
  "retentionNextDay",
  "next_day_retention",
  "day2_retention",
  "retain_day2",
  "againActiveCount",
  "again_active_count",
  "reg_second_count",
] as const;

function statRowDateKey(row: AdminStatSummaryRow): string {
  const s = pickStr(row, ["theDate", "the_date", "stat_date", "date", "statDate"]);
  return s === "—" ? "" : s;
}

function isStatRowToday(row: AdminStatSummaryRow): boolean {
  const d = statRowDateKey(row);
  if (d === "") {
    return false;
  }
  return dayjs().format("YYYY-MM-DD") === dayjs(d).format("YYYY-MM-DD");
}

/** 与 lot.www 一致：非当天且新增 > 0 时展示整数百分比，否则展示 — */
function formatRetentionRatePercent(row: AdminStatSummaryRow): string | null {
  if (isStatRowToday(row)) {
    return null;
  }
  const retained = pickNumValue(row, [...RETENTION_FIELD_KEYS]);
  const registered = pickNumValue(row, [...NEW_REG_FIELD_KEYS]);
  if (registered == null || registered === 0) {
    return null;
  }
  const numerator = retained ?? 0;
  return `${((numerator / registered) * 100).toFixed(0)}%`;
}

/** `admin/stat/total` 扁平行：`stat_date` + `source` + `reg_count` 等 */
function isStatTotalFlatApiShape(rows: AdminStatSummaryRow[]): boolean {
  if (rows.length === 0) {
    return false;
  }
  if (rows.some((r) => Array.isArray(r.children) && (r.children as unknown[]).length > 0)) {
    return false;
  }
  return rows.some((r) => r["stat_date"] != null && r["reg_count"] !== undefined);
}

function mapFlatStatRowToDetail(raw: AdminStatSummaryRow): AdminStatSummaryRow {
  const o = raw as Record<string, unknown>;
  const date = String(o["stat_date"] ?? "").trim();
  const src = String(o["source"] ?? "").trim();
  const id = o["id"];
  const reg = o["reg_count"];
  const reg2 = o["reg_second_count"];
  const login2 = o["login_second_count"];
  const login = o["login_count"];
  const sub = o["subscription_count"];
  const sub2 = o["subscription_second_count"];
  const subFail = o["subscription_fail_count"];
  return {
    ...raw,
    key: String(id ?? `${date}_${src}`),
    _rowKind: "detail",
    theDate: date,
    packageName: src,
    newRegister: reg,
    retentionNextDay: reg2,
    loginSecondCount: login2,
    activeCount: login,
    subscriptionCount: sub,
    subscriptionSecondCount: sub2,
    subscriptionSecondFail: subFail,
  };
}

function sumNum(rows: AdminStatSummaryRow[], key: string): number {
  let t = 0;
  for (const r of rows) {
    const n = Number(r[key]);
    if (Number.isFinite(n)) {
      t += n;
    }
  }
  return t;
}

function statRowSortDate(row: AdminStatSummaryRow): string {
  const s = pickStr(row, ["theDate", "the_date", "stat_date", "date", "statDate"]);
  return s === "—" ? "" : s;
}

function pickChannelLabel(row: AdminStatSummaryRow): string {
  return String(row.packageName ?? row["source"] ?? "").trim();
}

/**
 * 渠道展示顺序：① `A`+数字包码；② 当前站点裸域；③ 当前站点 www 域；④ 其余最后。
 */
function activeSiteHostOrder(): string[] {
  try {
    const host = new URL(getActiveAdminSite().publicWebOrigin).hostname.toLowerCase();
    const bare = host.replace(/^www\./, "");
    return Array.from(new Set([bare, `www.${bare}`]));
  } catch {
    return [];
  }
}

function channelSortTier(source: string): number {
  const s = source.trim();
  if (s === "") {
    return 99;
  }
  if (/^A\d/i.test(s)) {
    return 0;
  }
  const low = s.toLowerCase();
  const hostIndex = activeSiteHostOrder().indexOf(low);
  if (hostIndex >= 0) {
    return hostIndex + 1;
  }
  return 3;
}

function compareChannelSource(a: string, b: string): number {
  const ta = channelSortTier(a);
  const tb = channelSortTier(b);
  if (ta !== tb) {
    return ta - tb;
  }
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/** 日期新→旧，同日按渠道排序规则 */
function sortStatTotalFlatRows(rows: AdminStatSummaryRow[]): AdminStatSummaryRow[] {
  return [...rows].sort((a, b) => {
    const cmp = statRowSortDate(b).localeCompare(statRowSortDate(a));
    if (cmp !== 0) {
      return cmp;
    }
    return compareChannelSource(pickChannelLabel(a), pickChannelLabel(b));
  });
}

/** 按自然日父行汇总 + 各 `source` 子行（日期新→旧） */
function groupStatTotalFlatRows(flat: AdminStatSummaryRow[]): AdminStatSummaryRow[] {
  const details = sortStatTotalFlatRows(flat.map(mapFlatStatRowToDetail));
  const byDate = new Map<string, AdminStatSummaryRow[]>();
  for (const row of details) {
    const d = String(row.theDate ?? "").trim();
    if (d === "") {
      continue;
    }
    const arr = byDate.get(d) ?? [];
    arr.push(row);
    byDate.set(d, arr);
  }
  const datesDesc = [...byDate.keys()].sort((a, b) => b.localeCompare(a));
  return datesDesc.map((dateStr) => {
    const rawChildren = byDate.get(dateStr) ?? [];
    const children = [...rawChildren].sort((a, b) =>
      compareChannelSource(pickChannelLabel(a), pickChannelLabel(b)),
    );
    const names = children
      .map((c) => String(c.packageName ?? "").trim())
      .filter((s) => s !== "");
    return {
      key: `sum_${dateStr}`,
      _rowKind: "summary",
      _primary: true,
      theDate: dateStr,
      _channelNames: names,
      children,
      newRegister: sumNum(children, "newRegister"),
      retentionNextDay: sumNum(children, "retentionNextDay"),
      loginSecondCount: sumNum(children, "loginSecondCount"),
      activeCount: sumNum(children, "activeCount"),
      subscriptionCount: sumNum(children, "subscriptionCount"),
      subscriptionSecondCount: sumNum(children, "subscriptionSecondCount"),
      subscriptionSecondFail: sumNum(children, "subscriptionSecondFail"),
    } as AdminStatSummaryRow;
  });
}

function adaptStatTotalRows(list: AdminStatSummaryRow[]): AdminStatSummaryRow[] {
  if (!isStatTotalFlatApiShape(list)) {
    return list;
  }
  return groupStatTotalFlatRows(list);
}

export function SummaryStatistics() {
  const screens = Grid.useBreakpoint();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AdminStatSummaryRow[]>([]);
  const [expandedRowKeys, setExpandedRowKeys] = useState<Key[]>([]);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>(() => defaultRange());
  const [channel, setChannel] = useState("");

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        daterange: rangeToStatTotalDaterange(dateRange),
      };
      const kw = channel.trim();
      if (kw !== "") {
        body.keyword = kw;
      }
      const res: ApiResult<AdminStatTotalPayload> = await apiPostJson<AdminStatTotalPayload>("admin/stat/total", body);
      if (res.c !== 0) {
        message.error(res.m || "加载失败");
        setRows([]);
        return;
      }
      const d = res.d;
      const list = Array.isArray(d?.data) ? d.data : Array.isArray(d?.rows) ? d.rows : [];
      setRows(adaptStatTotalRows(list));
    } catch {
      message.error("网络异常");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [channel, dateRange]);

  useEffect(() => {
    void fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 首屏拉取；改日期/渠道后请点「搜索」
  }, []);

  /** 数据到达后再展开：`defaultExpandAllRows` 在异步 setState 后常不生效，改受控 */
  useEffect(() => {
    setExpandedRowKeys(defaultExpandedParentKeys(rows));
  }, [rows]);

  const columns: ColumnsType<AdminStatSummaryRow> = useMemo(
    () => [
      /** 首列合并：树形展开箭头 + 日期（expandIconColumnIndex: 0） */
      {
        /** 与表体汇总行同一栅格：缩进位(0) + 箭头区(22px) + 文案，避免「日期」只贴在 th 最左侧 */
        title: (
          <div className={styles.dateHeadMirror}>
            <span className={styles.dateHeadIndentMirror} aria-hidden />
            <span className={styles.dateHeadBtnMirror} aria-hidden />
            <span className={styles.dateHeadLabel}>日期</span>
          </div>
        ),
        key: "theDate",
        width: 188,
        fixed: screens.md ? "left" : undefined,
        className: styles.dateExpandMergedCol,
        onCell: (record) => ({
          style: cellBg(record),
        }),
        render: (_: unknown, row) => {
          if (isNestedTreeDetail(row)) {
            return null;
          }
          return (
            <span className={styles.dateCellText}>{pickStr(row, ["theDate", "the_date", "stat_date", "date", "statDate"])}</span>
          );
        },
      },
      {
        title: "渠道",
        key: "channel",
        width: 152,
        minWidth: 120,
        ellipsis: false,
        onCell: (record) => ({
          style: cellBg(record),
        }),
        render: (_: unknown, row) => {
          if (row._rowKind === "detail") {
            return (
              <span className={styles.channelDetailCell}>{pickStr(row, ["packageName", "package_name", "channel", "source"])}</span>
            );
          }
          const names = channelNamesFromRow(row);
          const kids = row.children as AdminStatSummaryRow[] | undefined;
          if (names.length === 0) {
            return <span className={styles.channelSummaryInline}>—</span>;
          }
          if (Array.isArray(kids) && kids.length > 1) {
            return (
              <Tooltip title={names.join("\n")} placement="topLeft">
                <span className={styles.channelSummaryInline}>汇总（{kids.length}）</span>
              </Tooltip>
            );
          }
          if (Array.isArray(kids) && kids.length === 1) {
            return <span className={styles.channelSummaryInline}>{names[0]}</span>;
          }
          return <span className={styles.channelSummaryInline}>{names.join("、")}</span>;
        },
      },
      {
        title: "新增注册",
        key: "newReg",
        width: 100,
        className: styles.numCell,
        onCell: (record) => ({
          style: cellBg(record),
        }),
        render: (_: unknown, row) => pickNum(row, [...NEW_REG_FIELD_KEYS]),
      },
      {
        title: (
          <Tooltip title="人数 reg_second_count；下方百分比 = reg_second_count ÷ reg_count">
            <span>次日留存</span>
          </Tooltip>
        ),
        key: "retention",
        width: 100,
        align: "center",
        className: styles.numCell,
        onCell: (record) => ({
          style: cellBg(record),
        }),
        render: (_: unknown, row) => {
          const count = pickNum(row, [...RETENTION_FIELD_KEYS]);
          const rate = formatRetentionRatePercent(row);
          return (
            <div className={styles.retentionCell}>
              <span>{count}</span>
              {rate != null ? <span className={styles.retentionRate}>{rate}</span> : null}
            </div>
          );
        },
      },
      {
        title: (
          <Tooltip title="接口字段 login_second_count（登录侧「次日」统计，与 reg_second_count 不同）">
            <span>登录次日</span>
          </Tooltip>
        ),
        key: "loginSecond",
        width: 100,
        className: styles.numCell,
        onCell: (record) => ({
          style: cellBg(record),
        }),
        render: (_: unknown, row) =>
          pickNum(row, ["loginSecondCount", "login_second_count", "loginSecond", "login_second"]),
      },
      {
        title: "活跃数",
        key: "active",
        width: 100,
        className: styles.numCell,
        onCell: (record) => ({
          style: cellBg(record),
        }),
        render: (_: unknown, row) =>
          pickNum(row, ["activeCount", "active_count", "activePerson", "active_person", "login_count"]),
      },
      {
        title: "订阅次数",
        key: "subCount",
        width: 108,
        className: styles.numCell,
        onCell: (record) => ({
          style: cellBg(record),
        }),
        render: (_: unknown, row) =>
          pickNum(row, ["subscriptionCount", "subscription_count", "subscribe_count", "sub_count"]),
      },
      {
        title: "二次订阅次数",
        key: "sub2Count",
        width: 120,
        className: styles.numCell,
        onCell: (record) => ({
          style: cellBg(record),
        }),
        render: (_: unknown, row) =>
          pickNum(row, [
            "subscriptionSecondCount",
            "second_subscription_count",
            "subscribe_second_count",
            "sub_second_count",
            "subscription_second_count",
          ]),
      },
      {
        title: (
          <Tooltip title="接口字段 subscription_fail_count（若后端仅统计二次失败，可与产品文案对齐为「二次」）">
            <span>订阅失败次数</span>
          </Tooltip>
        ),
        key: "sub2Fail",
        width: 120,
        className: styles.numCell,
        onCell: (record) => ({
          style: cellBg(record),
        }),
        render: (_: unknown, row) =>
          pickNum(row, [
            "subscriptionSecondFail",
            "second_subscription_fail",
            "subscribe_second_fail",
            "sub_second_fail",
            "subscription_fail_count",
          ]),
      },
    ],
    [
      screens.md,
      styles.dateHeadMirror,
      styles.dateHeadIndentMirror,
      styles.dateHeadBtnMirror,
      styles.dateHeadLabel,
      styles.dateExpandMergedCol,
      styles.dateCellText,
      styles.channelSummaryInline,
      styles.channelDetailCell,
      styles.retentionCell,
      styles.retentionRate,
    ],
  );

  const expandableConfig = useMemo(
    () => ({
      expandedRowKeys,
      onExpandedRowsChange: (keys: readonly Key[]) => {
        setExpandedRowKeys([...keys]);
      },
      expandRowByClick: true,
      expandIconColumnIndex: 0,
      expandIcon: ({
        expanded,
        onExpand,
        record,
      }: {
        expanded: boolean;
        onExpand: (r: AdminStatSummaryRow, e: MouseEvent<HTMLElement>) => void;
        record: AdminStatSummaryRow;
      }) => {
        const kids = record.children;
        const hasChildren = Array.isArray(kids) && kids.length > 0;
        if (!hasChildren) {
          return <span className={styles.expandLeafSpacer} aria-hidden />;
        }
        return (
          <button
            type="button"
            className={styles.expandArrowBtn}
            onClick={(e) => {
              e.stopPropagation();
              onExpand(record, e);
            }}
            aria-label={expanded ? "收起" : "展开"}
            aria-expanded={expanded}
          >
            {expanded ? <UpOutlined className={styles.expandArrowIcon} /> : <DownOutlined className={styles.expandArrowIcon} />}
          </button>
        );
      },
    }),
    [expandedRowKeys, styles.expandLeafSpacer, styles.expandArrowBtn, styles.expandArrowIcon],
  );

  return (
    <div className={styles.page}>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        汇总统计
      </Typography.Title>
      <div className={`${stylesToolbar.toolbar} ${styles.toolbarMobile}`}>
        <Space wrap className={styles.toolbarRight}>
          <Typography.Text type="secondary">日期</Typography.Text>
          <DatePicker.RangePicker
            className={styles.dateRange}
            format="YYYY-MM-DD"
            value={dateRange}
            onChange={(dates) => {
              if (dates?.[0] && dates[1]) {
                let a = dates[0].startOf("day");
                let b = dates[1].endOf("day");
                if (a.isAfter(b.startOf("day"))) {
                  a = dates[1].startOf("day");
                  b = dates[0].endOf("day");
                }
                setDateRange([a, b]);
              }
            }}
          />
          <Typography.Text type="secondary">渠道</Typography.Text>
          <Input
            className={styles.channelSelect}
            placeholder="请输入渠道码"
            allowClear
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
          />
          <Button type="primary" onClick={() => void fetchList()}>
            搜索
          </Button>
        </Space>
      </div>

      <div className={styles.tableScroll}>
        <Table<AdminStatSummaryRow>
          className={styles.summaryStatsTable}
          rowKey={(row) => tableRowKey(row)}
          onRow={(record) =>
            ({
              "data-row-kind": String(record._rowKind ?? ""),
            }) as HTMLAttributes<HTMLTableRowElement>
          }
          rowClassName={(record) => {
            if (record._rowKind === "summary") {
              return styles.summaryRow;
            }
            if (record._rowKind === "detail") {
              return styles.childRow;
            }
            return "";
          }}
          loading={loading}
          columns={columns}
          dataSource={rows}
          pagination={false}
          sticky={mainContentTableSticky}
          scroll={{ x: 1180 }}
          size="middle"
          indentSize={20}
          expandable={expandableConfig}
          locale={{
            emptyText: loading
              ? "加载中…"
              : channel.trim() !== ""
                ? "暂无数据（请确认渠道码或日期范围）"
                : "暂无数据（请检查日期范围是否包含有效自然日）",
          }}
        />
      </div>
    </div>
  );
}
