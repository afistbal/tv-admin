import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type Key,
  type MouseEvent,
} from "react";
import { DownOutlined, UpOutlined } from "@ant-design/icons";
import { Button, DatePicker, Input, Space, Table, Typography } from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import type { ColumnsType } from "antd/es/table";
import type { AdminStatSummaryRow } from "@/types/adminStatSummary";
import stylesToolbar from "./UserList.module.css";
import styles from "./SummaryStatistics.module.css";

/** 下拉假渠道（包码样式；接口就绪后改由服务端返回） */
const MOCK_CHANNELS = ["A100F100", "B200F200", "C300F300"] as const;

/** 默认恰好 3 个自然日：今日往前共 3 天 → 起 = 今日-2 的 00:00，止 = 今日 23:59 */
function defaultRange(): [Dayjs, Dayjs] {
  const end = dayjs().endOf("day");
  const start = dayjs().subtract(2, "day").startOf("day");
  return [start, end];
}

/** 按日期字符串 + 渠道生成稳定伪随机整数 */
function mockInt(dateStr: string, channel: string, salt: number, mod: number): number {
  let h = salt;
  const s = `${dateStr}|${channel}`;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) >>> 0;
  }
  return (h % mod) + 1;
}

function sumField(rows: AdminStatSummaryRow[], key: string): number {
  return rows.reduce((a, r) => {
    const v = r[key];
    const n = Number(v);
    return a + (Number.isFinite(n) ? n : 0);
  }, 0);
}

/**
 * 假数据约定：
 * - **未选渠道（全部）**：每日一条汇总父行 + **`children` 各渠道明细**（默认展开，可看渠道数据）。
 * - **选了某一渠道搜索**：每日一条扁平行（无 children），与汇总行同款样式。
 * 日期顺序：新 → 旧。
 */
function buildMockRows(range: [Dayjs, Dayjs], channelFilter: string): AdminStatSummaryRow[] {
  const trimmed = channelFilter.trim();
  /** 留空 = 全部 MOCK 渠道；非空 = 按粘贴/输入的单个渠道码筛选（不限制为下拉项） */
  const channels = trimmed !== "" ? [trimmed] : [...MOCK_CHANNELS];
  if (channels.length === 0) {
    return [];
  }

  /** 起止反了或同一天选错顺序时，仍会生成 0 行 → 先规范为 start ≤ end（按自然日） */
  let startDay = range[0].startOf("day");
  let endDay = range[1].startOf("day");
  if (startDay.isAfter(endDay)) {
    const t = startDay;
    startDay = endDay;
    endDay = t;
  }

  const dateAsc: Dayjs[] = [];
  let d = startDay;
  while (!d.isAfter(endDay)) {
    dateAsc.push(d);
    d = d.add(1, "day");
  }
  const datesNewestFirst = [...dateAsc].reverse();

  const singleChannelOnly = channels.length === 1;
  const out: AdminStatSummaryRow[] = [];

  for (const day of datesNewestFirst) {
    const dateStr = day.format("YYYY-MM-DD");

    if (singleChannelOnly) {
      const ch = channels[0];
      out.push({
        key: `${dateStr}_${ch}`,
        _rowKind: "summary",
        _channelNames: [ch],
        theDate: dateStr,
        packageName: ch,
        newRegister: mockInt(dateStr, ch, 11, 80),
        retentionNextDay: mockInt(dateStr, ch, 22, 40),
        activeCount: mockInt(dateStr, ch, 33, 200) + 50,
        subscriptionCount: mockInt(dateStr, ch, 44, 60),
        subscriptionSecondCount: mockInt(dateStr, ch, 55, 25),
        subscriptionSecondFail: mockInt(dateStr, ch, 66, 8),
      });
      continue;
    }

    const details: AdminStatSummaryRow[] = channels.map((ch) => ({
      key: `${dateStr}_${ch}`,
      _rowKind: "detail",
      theDate: dateStr,
      packageName: ch,
      newRegister: mockInt(dateStr, ch, 11, 80),
      retentionNextDay: mockInt(dateStr, ch, 22, 40),
      activeCount: mockInt(dateStr, ch, 33, 200) + 50,
      subscriptionCount: mockInt(dateStr, ch, 44, 60),
      subscriptionSecondCount: mockInt(dateStr, ch, 55, 25),
      subscriptionSecondFail: mockInt(dateStr, ch, 66, 8),
    }));

    const summary: AdminStatSummaryRow = {
      key: `sum_${dateStr}`,
      _rowKind: "summary",
      _primary: true,
      theDate: dateStr,
      _channelNames: [...channels],
      children: details,
      newRegister: sumField(details, "newRegister"),
      retentionNextDay: sumField(details, "retentionNextDay"),
      activeCount: sumField(details, "activeCount"),
      subscriptionCount: sumField(details, "subscriptionCount"),
      subscriptionSecondCount: sumField(details, "subscriptionSecondCount"),
      subscriptionSecondFail: sumField(details, "subscriptionSecondFail"),
    };

    out.push(summary);
  }
  return out;
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
      const n = String(o.packageName ?? o.package_name ?? o.channel ?? "").trim();
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

export function SummaryStatistics() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AdminStatSummaryRow[]>([]);
  const [expandedRowKeys, setExpandedRowKeys] = useState<Key[]>([]);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>(() => defaultRange());
  const [channel, setChannel] = useState("");

  const loadMock = useCallback(() => {
    setLoading(true);
    window.setTimeout(() => {
      setRows(buildMockRows(dateRange, channel));
      setLoading(false);
    }, 120);
  }, [channel, dateRange]);

  useEffect(() => {
    loadMock();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅挂载加载；改条件后请点「搜索」
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
        width: 260,
        fixed: "left",
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
        minWidth: 220,
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
          if (names.length === 0) {
            return <span className={styles.channelSummaryInline}>—</span>;
          }
          const line = names.join("、");
          return <span className={styles.channelSummaryInline}>{line}</span>;
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
        render: (_: unknown, row) =>
          pickNum(row, ["newRegister", "new_register", "regPerson", "reg_person", "new_reg"]),
      },
      {
        title: "次日留存",
        key: "retention",
        width: 100,
        className: styles.numCell,
        onCell: (record) => ({
          style: cellBg(record),
        }),
        render: (_: unknown, row) =>
          pickNum(row, [
            "retentionNextDay",
            "next_day_retention",
            "day2_retention",
            "retain_day2",
            "againActiveCount",
            "again_active_count",
          ]),
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
          pickNum(row, ["activeCount", "active_count", "activePerson", "active_person"]),
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
          ]),
      },
      {
        title: "二次订阅失败",
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
          ]),
      },
    ],
    [
      styles.dateHeadMirror,
      styles.dateHeadIndentMirror,
      styles.dateHeadBtnMirror,
      styles.dateHeadLabel,
      styles.dateExpandMergedCol,
      styles.dateCellText,
      styles.channelSummaryInline,
      styles.channelDetailCell,
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
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        汇总统计
      </Typography.Title>
      <div className={stylesToolbar.toolbar}>
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
          <Button type="primary" onClick={() => loadMock()}>
            搜索
          </Button>
        </Space>
      </div>

      <Table<AdminStatSummaryRow>
        className={styles.summaryStatsTable}
        rowKey={(row) => tableRowKey(row)}
        onRow={(record) => ({
          "data-row-kind": record._rowKind ?? "",
        })}
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
        scroll={{ x: 1196 }}
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
  );
}
