import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, DatePicker, Input, Pagination, Table, Typography, message } from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import type { ColumnsType } from "antd/es/table";
import { apiGet } from "@/api/client";
import type { ApiGetQueryValue } from "@/api/client";
import type { ApiResult } from "@/api/types";
import type { AdminFeedbackListPayload, AdminFeedbackRow } from "@/types/adminFeedback";
import { formatDateTimeZh } from "@/lib/formatDateTime";
import { mainContentTableSticky } from "@/lib/tableSticky";
import orderStyles from "./OrderList.module.css";
import listStyles from "./FeedbackList.module.css";
import styles from "./UserList.module.css";

function defaultTodayRange(): [Dayjs, Dayjs] {
  const d = dayjs();
  return [d.startOf("day"), d.startOf("day")];
}

function rangeToDaterangeStrings(range: [Dayjs, Dayjs]): [string, string] {
  const [from, to] = range;
  return [from.startOf("day").format("YYYY-MM-DD HH:mm:ss"), to.endOf("day").format("YYYY-MM-DD HH:mm:ss")];
}

export function FeedbackList() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AdminFeedbackRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(24);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(() => defaultTodayRange());

  const fetchList = useCallback(async (p: number, kw: string, range: [Dayjs, Dayjs] | null) => {
    setLoading(true);
    try {
      const kwTrim = kw.trim();
      const q: Record<string, ApiGetQueryValue> = {
        page: p,
        keyword: kwTrim || undefined,
      };
      if (range != null) {
        q.daterange = rangeToDaterangeStrings(range);
      }
      const res: ApiResult<AdminFeedbackListPayload> = await apiGet<AdminFeedbackListPayload>("admin/feedback", q);
      if (res.c !== 0) {
        message.error(res.m || "加载失败");
        setRows([]);
        setTotal(0);
        return;
      }
      const d = res.d;
      setRows(Array.isArray(d.data) ? d.data : []);
      setTotal(Number(d.count) || 0);
      setPerPage(Number(d.per_page) || 24);
      setPage(Number(d.current_page) || p);
    } catch {
      message.error("网络异常");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchList(page, keyword, dateRange);
  }, [page, keyword, dateRange, fetchList]);

  const columns: ColumnsType<AdminFeedbackRow> = useMemo(
    () => [
      {
        title: "反馈 ID",
        dataIndex: "id",
        width: 96,
      },
      {
        title: "用户 ID",
        dataIndex: "user_id",
        width: 96,
        render: (v: unknown) => {
          const s = v != null && String(v) !== "" ? String(v) : "";
          if (!s) {
            return "—";
          }
          return <Typography.Text copyable={{ text: s }}>{s}</Typography.Text>;
        },
      },
      {
        title: "用户邮箱",
        dataIndex: "email",
        width: 220,
        ellipsis: { showTitle: true },
        render: (v: unknown) => {
          const s = v != null ? String(v).trim() : "";
          if (!s) {
            return "—";
          }
          return <Typography.Text copyable={{ text: s }}>{s}</Typography.Text>;
        },
      },
      {
        title: "反馈描述",
        dataIndex: "content",
        render: (v: unknown) => {
          const s = v != null ? String(v).trim() : "";
          if (!s) {
            return "—";
          }
          return (
            <div className={listStyles.contentCell} title={s}>
              <span className={listStyles.twoLinesText}>{s}</span>
            </div>
          );
        },
      },
      {
        title: "提交时间",
        dataIndex: "created_at",
        width: 180,
        render: (v: unknown) => formatDateTimeZh(v != null ? String(v) : null),
      },
    ],
    [],
  );

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        反馈列表
      </Typography.Title>

      <div className={orderStyles.filterWrap}>
        <div className={orderStyles.filterBar}>
          <div className={orderStyles.filterItem}>
            <span className={orderStyles.filterLabel}>日期：</span>
            <DatePicker.RangePicker
              className={orderStyles.dateRange}
              format="YYYY-MM-DD"
              allowClear
              value={dateRange}
              onChange={(dates) => {
                if (dates?.[0] && dates[1]) {
                  setDateRange([dates[0].startOf("day"), dates[1].startOf("day")]);
                  setPage(1);
                } else {
                  setDateRange(null);
                  setPage(1);
                }
              }}
              presets={[
                {
                  label: "今天",
                  value: [dayjs().startOf("day"), dayjs().startOf("day")] satisfies [Dayjs, Dayjs],
                },
                {
                  label: "昨天",
                  value: [dayjs().subtract(1, "day").startOf("day"), dayjs().subtract(1, "day").startOf("day")] satisfies [
                    Dayjs,
                    Dayjs,
                  ],
                },
              ]}
            />
          </div>
          <div className={orderStyles.filterItem}>
            <span className={orderStyles.filterLabel}>关键词：</span>
            <Input
              allowClear
              placeholder="邮箱 / 反馈内容"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onPressEnter={() => {
                const kw = keywordInput.trim();
                setKeyword(kw);
                setPage(1);
              }}
              style={{ width: 220 }}
              maxLength={64}
            />
          </div>
          <Button
            type="primary"
            onClick={() => {
              const kw = keywordInput.trim();
              setKeyword(kw);
              setPage(1);
              if (page === 1) {
                void fetchList(1, kw, dateRange);
              }
            }}
          >
            搜索
          </Button>
          <span className={orderStyles.totalHint}>共 {total} 条</span>
        </div>
      </div>

      <Table<AdminFeedbackRow>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={false}
        sticky={mainContentTableSticky}
        scroll={{ x: 956 }}
        size="middle"
      />

      <div className={styles.paginationWrap}>
        <Pagination
          current={page}
          pageSize={perPage}
          total={total}
          showSizeChanger={false}
          showTotal={(t) => `共 ${t} 条`}
          onChange={(p) => setPage(p)}
        />
      </div>
    </div>
  );
}
