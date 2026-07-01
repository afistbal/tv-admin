import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Input, InputNumber, Modal, Pagination, Select, Space, Switch, Table, Tag, Tooltip, Typography, message } from "antd";
import { InfoCircleFilled, SearchOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { apiGet, apiPostJson } from "@/api/client";
import type { ApiResult } from "@/api/types";
import { mainContentTableSticky } from "@/lib/tableSticky";
import type {
  AdminTagCategory,
  AdminTagCategoryMappingRow,
  AdminTagCategoryMappingsPayload,
  AdminTagCategorySavePayload,
} from "@/types/adminTagCategory";
import stylesToolbar from "./UserList.module.css";
import styles from "./TagCategoryMappings.module.css";

const ALL_CATEGORY = "all";
const DEFAULT_PAGE_SIZE = 20;
const SEARCH_DELAY = 400;

const CATEGORY_FALLBACK_LABELS: Record<string, string> = {
  story: "Story",
  characters: "Characters",
  setting: "Setting",
  genre: "Genre",
  style: "Style",
  other: "其它",
};

const CATEGORY_HINTS: Record<string, { hint: string; description: string }> = {
  story: { hint: "剧情", description: "剧情、关系、事件、故事结构类 Tag" },
  characters: { hint: "角色", description: "人物身份、角色属性、人物关系类 Tag" },
  setting: { hint: "设定", description: "时间、地点、世界观、环境设定类 Tag" },
  genre: { hint: "题材", description: "题材类型类 Tag" },
  style: { hint: "风格", description: "内容风格、情绪、表达方式类 Tag" },
  other: { hint: "其它", description: "待归类或暂不适合归入以上分类的 Tag" },
};

type PendingSortChange = {
  tag: string;
  row: AdminTagCategoryMappingRow;
  originalSort: number;
  nextSort: number;
};

function normalizeSortValue(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function tagRequestValue(row: AdminTagCategoryMappingRow): string {
  const uniqueId = String(row.unique_id ?? "").trim();
  if (uniqueId) {
    return uniqueId;
  }
  const tagName = String(row.tag_name ?? "").trim();
  if (tagName) {
    return tagName;
  }
  return String(row.tag_id);
}

function tagIdText(row: AdminTagCategoryMappingRow): string {
  return String(row.tag_name || row.tag_id || "");
}

function tagNameText(row: AdminTagCategoryMappingRow): string {
  return String(row.unique_id || row.tag_name || row.tag_id || "");
}

function formatTagNameForDisplay(row: AdminTagCategoryMappingRow): string {
  const raw = tagNameText(row).trim();
  if (!raw) {
    return "";
  }
  return raw
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function categoryName(category: AdminTagCategory | null | undefined): string {
  if (!category) {
    return "未归类";
  }
  return category.name || CATEGORY_FALLBACK_LABELS[category.slug] || category.slug || "未归类";
}

function categoryDisplayName(category: AdminTagCategory | null | undefined): string {
  if (!category) {
    return "未归类";
  }
  const name = categoryName(category);
  const hint = CATEGORY_HINTS[category.slug]?.hint;
  return hint ? `${hint}（${name}）` : name;
}

function categoryDescription(category: AdminTagCategory | null | undefined): string {
  if (!category) {
    return "未归类";
  }
  return CATEGORY_HINTS[category.slug]?.description ?? categoryDisplayName(category);
}

function categoryTagColor(slug: string | undefined): string | undefined {
  if (slug === "story") {
    return "blue";
  }
  if (slug === "characters") {
    return "purple";
  }
  if (slug === "setting") {
    return "green";
  }
  if (slug === "genre") {
    return "gold";
  }
  if (slug === "style") {
    return "magenta";
  }
  if (slug === "other") {
    return "default";
  }
  return undefined;
}

function TagSortInput(props: {
  row: AdminTagCategoryMappingRow;
  disabled: boolean;
  value: number;
  onCommit: (row: AdminTagCategoryMappingRow, sort: number) => void;
}) {
  const { row, disabled, value: initial, onCommit } = props;
  const [value, setValue] = useState<number | null>(initial);

  useEffect(() => {
    setValue(initial);
  }, [initial, row.tag_id]);

  const commit = () => {
    if (value == null) {
      setValue(initial);
      message.warning("请输入分类内排序");
      return;
    }
    const next = Math.trunc(Number(value));
    if (!Number.isFinite(next) || next < 0) {
      setValue(initial);
      message.warning("排序需为非负整数");
      return;
    }
    setValue(next);
    if (next !== initial) {
      onCommit(row, next);
    }
  };

  return (
    <InputNumber<number>
      className={styles.sortInput}
      controls={false}
      disabled={disabled}
      min={0}
      precision={0}
      size="small"
      value={value}
      onBlur={commit}
      onChange={(next) => setValue(typeof next === "number" && Number.isFinite(next) ? next : null)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
    />
  );
}

export function TagCategoryMappings() {
  const [categories, setCategories] = useState<AdminTagCategory[]>([]);
  const [rows, setRows] = useState<AdminTagCategoryMappingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [totalTags, setTotalTags] = useState(0);
  const [unmappedTags, setUnmappedTags] = useState(0);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORY);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [batchSortMode, setBatchSortMode] = useState(false);
  const [pendingSortByTag, setPendingSortByTag] = useState<Record<string, PendingSortChange>>({});
  const [sortModalOpen, setSortModalOpen] = useState(false);
  const [sortSubmitting, setSortSubmitting] = useState(false);
  const searchTimer = useRef<number | null>(null);

  const categoryOptions = useMemo(
    () => [
      { value: ALL_CATEGORY, label: "全部分类" },
      ...categories.map((item) => ({
        value: String(item.id),
        label: categoryDisplayName(item),
      })),
    ],
    [categories],
  );

  const rowCategoryOptions = useMemo(
    () =>
      categories.map((item) => ({
        value: String(item.id),
        label: categoryDisplayName(item),
      })),
    [categories],
  );

  const pendingSortList = useMemo(() => Object.values(pendingSortByTag), [pendingSortByTag]);
  const pendingSortCount = pendingSortList.length;

  const fetchCategories = useCallback(async () => {
    try {
      const res: ApiResult<AdminTagCategory[]> = await apiGet<AdminTagCategory[]>("admin/tag-categories");
      if (res.c !== 0) {
        message.error(res.m || "分类加载失败");
        setCategories([]);
        return;
      }
      setCategories(Array.isArray(res.d) ? res.d : []);
    } catch {
      message.error("分类加载失败");
      setCategories([]);
    }
  }, []);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res: ApiResult<AdminTagCategoryMappingsPayload> = await apiGet<AdminTagCategoryMappingsPayload>(
        "admin/tag-category-mappings",
        {
          page,
          pageSize,
          category_id: categoryFilter === ALL_CATEGORY ? undefined : categoryFilter,
          keyword,
        },
      );
      if (res.c !== 0) {
        message.error(res.m || "列表加载失败");
        setRows([]);
        setTotal(0);
        return;
      }

      const d = res.d;
      setRows(d && Array.isArray(d.data) ? d.data : []);
      setPage(Number(d?.current_page) || page);
      setPageSize(Number(d?.per_page) || pageSize);
      setTotal(Number(d?.count) || 0);
      setTotalTags(Number(d?.summary?.total_tags) || 0);
      setUnmappedTags(Number(d?.summary?.unmapped_tags) || 0);
    } catch {
      message.error("网络异常");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, keyword, page, pageSize]);

  useEffect(() => {
    void fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  useEffect(
    () => () => {
      if (searchTimer.current) {
        window.clearTimeout(searchTimer.current);
      }
    },
    [],
  );

  const applyKeyword = useCallback((nextKeyword: string) => {
    setKeyword(nextKeyword.trim());
    setPage(1);
  }, []);

  const scheduleKeywordSearch = useCallback(
    (nextKeyword: string) => {
      if (searchTimer.current) {
        window.clearTimeout(searchTimer.current);
      }
      searchTimer.current = window.setTimeout(() => {
        applyKeyword(nextKeyword);
      }, SEARCH_DELAY);
    },
    [applyKeyword],
  );

  const handleKeywordChange = (value: string) => {
    setKeywordInput(value);
    scheduleKeywordSearch(value);
  };

  const commitKeywordNow = () => {
    if (searchTimer.current) {
      window.clearTimeout(searchTimer.current);
    }
    applyKeyword(keywordInput);
  };

  const handleBatchModeChange = useCallback(
    (checked: boolean) => {
      if (checked) {
        setBatchSortMode(true);
        return;
      }
      if (pendingSortCount === 0) {
        setBatchSortMode(false);
        setSortModalOpen(false);
        return;
      }
      Modal.confirm({
        title: "切换到单个排序？",
        content: "当前未提交的批量排序改动会被清空。",
        okText: "切换",
        cancelText: "取消",
        onOk: () => {
          setPendingSortByTag({});
          setSortModalOpen(false);
          setBatchSortMode(false);
        },
      });
    },
    [pendingSortCount],
  );

  const handleSortDraftCommit = useCallback((row: AdminTagCategoryMappingRow, sort: number) => {
    const tag = tagRequestValue(row);
    if (!tag) {
      message.warning("缺少 Tag 标识");
      return;
    }
    setPendingSortByTag((prev) => {
      const existing = prev[tag];
      const originalSort = existing?.originalSort ?? normalizeSortValue(row.sort);
      if (sort === originalSort) {
        if (!existing) {
          return prev;
        }
        const next = { ...prev };
        delete next[tag];
        return next;
      }
      return {
        ...prev,
        [tag]: {
          tag,
          row,
          originalSort,
          nextSort: sort,
        },
      };
    });
  }, []);

  const handleImmediateSortCommit = useCallback(
    async (row: AdminTagCategoryMappingRow, sort: number) => {
      const tag = tagRequestValue(row);
      if (!tag) {
        message.warning("缺少 Tag 标识");
        return;
      }
      const key = `${tag}:sort`;
      setSavingKey(key);
      try {
        const res: ApiResult<null> = await apiPostJson<null>("admin/tag-category-mappings/sort", {
          orders: [{ tag, sort }],
        });
        if (res.c !== 0) {
          message.error(res.m || "排序更新失败");
          return;
        }
        message.success("排序已更新");
        await fetchList();
      } catch {
        message.error("网络异常");
      } finally {
        setSavingKey(null);
      }
    },
    [fetchList],
  );

  const handleSortCommit = useCallback(
    (row: AdminTagCategoryMappingRow, sort: number) => {
      if (batchSortMode) {
        handleSortDraftCommit(row, sort);
        return;
      }
      void handleImmediateSortCommit(row, sort);
    },
    [batchSortMode, handleImmediateSortCommit, handleSortDraftCommit],
  );

  const submitPendingSorts = useCallback(async () => {
    if (pendingSortList.length === 0) {
      return;
    }
    setSortSubmitting(true);
    try {
      const res: ApiResult<null> = await apiPostJson<null>("admin/tag-category-mappings/sort", {
        orders: pendingSortList.map((item) => ({ tag: item.tag, sort: item.nextSort })),
      });
      if (res.c !== 0) {
        message.error(res.m || "排序更新失败");
        return;
      }
      message.success("排序已更新");
      setPendingSortByTag({});
      setSortModalOpen(false);
      await fetchList();
    } catch {
      message.error("网络异常");
    } finally {
      setSortSubmitting(false);
    }
  }, [fetchList, pendingSortList]);

  const handleCategoryChange = useCallback(
    async (row: AdminTagCategoryMappingRow, nextCategoryId: string) => {
      const categoryId = Number(nextCategoryId);
      if (!Number.isFinite(categoryId)) {
        message.warning("请选择分类");
        return;
      }
      if (Number(row.category?.id) === categoryId) {
        return;
      }
      const tag = tagRequestValue(row);
      if (!tag) {
        message.warning("缺少 Tag 标识");
        return;
      }
      const key = `${tag}:category`;
      setSavingKey(key);
      try {
        const res: ApiResult<AdminTagCategorySavePayload> = await apiPostJson<AdminTagCategorySavePayload>(
          "admin/tag-category-mappings/save",
          {
            tag,
            category_id: categoryId,
            sort: normalizeSortValue(row.sort),
          },
        );
        if (res.c !== 0) {
          message.error(res.m || "分类更新失败");
          return;
        }
        const affected = Number(res.d?.affected_movie_tags) || 0;
        message.success(affected > 0 ? `分类已更新，影响 ${affected} 个短剧标签` : "分类已更新");
        setPendingSortByTag((prev) => {
          const existing = prev[tag];
          if (!existing) {
            return prev;
          }
          const nextCategory = categories.find((item) => item.id === categoryId) ?? row.category;
          return {
            ...prev,
            [tag]: {
              ...existing,
              row: {
                ...existing.row,
                category: nextCategory,
              },
            },
          };
        });
        await fetchList();
      } catch {
        message.error("网络异常");
      } finally {
        setSavingKey(null);
      }
    },
    [categories, fetchList],
  );

  const sortPreviewColumns: ColumnsType<PendingSortChange> = useMemo(
    () => [
      {
        title: "Tag 名称",
        key: "tag",
        width: 180,
        render: (_: unknown, item) => {
          const text = formatTagNameForDisplay(item.row);
          return (
            <Tooltip title={tagNameText(item.row)} placement="topLeft">
              <span className={styles.tagName}>{text || "-"}</span>
            </Tooltip>
          );
        },
      },
      {
        title: "对应分类",
        key: "category",
        width: 150,
        render: (_: unknown, item) => (
          <Tooltip title={categoryDescription(item.row.category)}>
            <Tag color={categoryTagColor(item.row.category?.slug)}>{categoryDisplayName(item.row.category)}</Tag>
          </Tooltip>
        ),
      },
      {
        title: "关联短剧",
        key: "movie_count",
        width: 96,
        align: "right",
        render: (_: unknown, item) => (
          <span className={styles.countCell}>
            <span className={styles.numberCell}>{Number(item.row.movie_count) || 0}</span>
            <span className={styles.numberUnit}> 个</span>
          </span>
        ),
      },
      {
        title: "排序变更",
        key: "sort",
        width: 140,
        align: "right",
        render: (_: unknown, item) => (
          <span className={styles.sortChangeText}>
            {item.originalSort} → {item.nextSort}
          </span>
        ),
      },
    ],
    [],
  );

  const columns: ColumnsType<AdminTagCategoryMappingRow> = useMemo(
    () => [
      {
        title: "Tag ID",
        key: "tag_id",
        width: 112,
        render: (_: unknown, row) => {
          const text = tagIdText(row);
          return (
            <Tooltip title={text} placement="topLeft">
              <span className={styles.monoToken}>{text || "-"}</span>
            </Tooltip>
          );
        },
      },
      {
        title: "Tag 名称",
        key: "tag_name",
        width: 200,
        render: (_: unknown, row) => {
          const text = formatTagNameForDisplay(row);
          const rawText = tagNameText(row);
          return (
            <Tooltip title={rawText} placement="topLeft">
              <span className={styles.tagName}>{text || "-"}</span>
            </Tooltip>
          );
        },
      },
      {
        title: "当前分类",
        key: "category",
        width: 140,
        align: "center",
        render: (_: unknown, row) => (
          <Tooltip title={categoryDescription(row.category)}>
            <Tag color={categoryTagColor(row.category?.slug)}>{categoryDisplayName(row.category)}</Tag>
          </Tooltip>
        ),
      },
      {
        title: "分类内排序",
        dataIndex: "sort",
        key: "sort",
        width: 128,
        render: (_: unknown, row) => {
          const tag = tagRequestValue(row);
          const pending = batchSortMode ? pendingSortByTag[tag] : undefined;
          const originalSort = pending?.originalSort ?? normalizeSortValue(row.sort);
          const displaySort = pending?.nextSort ?? originalSort;
          return (
            <div className={styles.sortCell}>
              <TagSortInput
                row={row}
                disabled={savingKey === `${tag}:sort` || savingKey === `${tag}:category`}
                value={displaySort}
                onCommit={handleSortCommit}
              />
              {pending ? (
                <Tooltip title={`原值：${originalSort}，当前值：${pending.nextSort}`}>
                  <InfoCircleFilled className={styles.sortDirtyIcon} />
                </Tooltip>
              ) : null}
            </div>
          );
        },
      },
      {
        title: "关联短剧",
        dataIndex: "movie_count",
        key: "movie_count",
        width: 96,
        align: "right",
        render: (value: unknown) => (
          <span className={styles.countCell}>
            <span className={styles.numberCell}>{Number(value) || 0}</span>
            <span className={styles.numberUnit}> 个</span>
          </span>
        ),
      },
      {
        title: "入库时间",
        dataIndex: "created_at",
        key: "created_at",
        width: 150,
        render: (value: unknown) => <span className={styles.timeCell}>{String(value || "-")}</span>,
      },
      {
        title: "操作",
        key: "action",
        width: 200,
        fixed: "right",
        align: "center",
        className: styles.actionCol,
        render: (_: unknown, row) => {
          const tag = tagRequestValue(row);
          return (
            <Select
              className={styles.categorySelect}
              disabled={rowCategoryOptions.length === 0 || savingKey === `${tag}:category`}
              loading={savingKey === `${tag}:category`}
              options={rowCategoryOptions}
              size="small"
              value={row.category?.id != null ? String(row.category.id) : undefined}
              onChange={(value) => void handleCategoryChange(row, value)}
            />
          );
        },
      },
    ],
    [batchSortMode, handleCategoryChange, handleSortCommit, pendingSortByTag, rowCategoryOptions, savingKey],
  );

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        Tag 分类管理
      </Typography.Title>

      <div className={stylesToolbar.toolbar}>
        <Space wrap className={stylesToolbar.toolbarLeft}>
          <Input
            allowClear
            className={styles.searchInput}
            maxLength={64}
            placeholder="输入 Tag 名称 / ID..."
            prefix={<SearchOutlined />}
            value={keywordInput}
            onChange={(event) => handleKeywordChange(event.target.value)}
            onPressEnter={commitKeywordNow}
          />
          <Space size={8}>
            <Typography.Text className={styles.filterLabel}>分类</Typography.Text>
            <Select
              options={categoryOptions}
              value={categoryFilter}
              style={{ width: 180 }}
              onChange={(value) => {
                setCategoryFilter(value);
                setPage(1);
              }}
            />
          </Space>
        </Space>
        <Space wrap className={stylesToolbar.toolbarRight}>
          <Space size={8}>
            <Typography.Text type="secondary">排序模式</Typography.Text>
            <Switch
              checked={batchSortMode}
              checkedChildren="批量排序"
              unCheckedChildren="单个排序"
              onChange={handleBatchModeChange}
            />
          </Space>
          {batchSortMode ? (
            <Button type="primary" disabled={pendingSortCount === 0} onClick={() => setSortModalOpen(true)}>
              批量排序（{pendingSortCount}）
            </Button>
          ) : null}
        </Space>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{totalTags}</div>
          <div className={styles.statLabel}>全部 Tag</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{unmappedTags}</div>
          <div className={styles.statLabel}>待归类其它</div>
        </div>
      </div>

      <div className={styles.tableWrap}>
        <Table<AdminTagCategoryMappingRow>
          className={styles.table}
          columns={columns}
          dataSource={rows}
          loading={loading}
          locale={{ emptyText: loading ? "加载中..." : "暂无数据" }}
          pagination={false}
          rowKey={(row) => `${row.tag_id}-${tagRequestValue(row)}`}
          scroll={{ x: 1030 }}
          size="middle"
          sticky={mainContentTableSticky}
          tableLayout="fixed"
        />
      </div>

      <div className={styles.paginationWrap}>
        <Pagination
          current={page}
          pageSize={pageSize}
          pageSizeOptions={[10, 20, 50, 100]}
          showSizeChanger
          showTotal={(value) => `共 ${value} 条`}
          total={total}
          onChange={(nextPage, nextPageSize) => {
            setPage(nextPageSize !== pageSize ? 1 : nextPage);
            setPageSize(nextPageSize);
          }}
        />
      </div>

      <Modal
        title={`确认批量排序（${pendingSortCount}）`}
        open={sortModalOpen}
        okText="确定"
        cancelText="取消"
        confirmLoading={sortSubmitting}
        okButtonProps={{ disabled: pendingSortCount === 0 }}
        onCancel={() => setSortModalOpen(false)}
        onOk={() => void submitPendingSorts()}
        width={720}
      >
        <Table<PendingSortChange>
          columns={sortPreviewColumns}
          dataSource={pendingSortList}
          pagination={false}
          rowKey={(item) => item.tag}
          size="small"
          tableLayout="fixed"
        />
      </Modal>
    </div>
  );
}
