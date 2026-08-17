import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Input, Modal, Switch, Table, Tabs, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { apiGet, apiPostJson } from "@/api/client";
import { getActiveSiteKey } from "@/api/baseURL";

type ConfigRow = {
  key: string;
  name: string;
};

type BasicSettingRow = {
  rowKey: string;
  id?: string | number;
  key: string;
  name: string;
  value: unknown;
};

type SearchResultRow = {
  key: string;
  id: string;
  title: string;
  thumbnailUrl: string;
  raw: Record<string, unknown>;
};

type RunningLogRow = {
  key: string;
  ffmpegId: string;
  createTime: string;
  runningTime: string;
};

const TOKEN_CONFIG_KEY = "third-party-token";
const SEARCH_CONFIG_KEY = "third-party-search";
const IOS_IFRAME_SETTING_KEY = "ios_iframe";

const CONFIG_ROWS: ConfigRow[] = [
  { key: TOKEN_CONFIG_KEY, name: "三方token信息" },
  { key: SEARCH_CONFIG_KEY, name: "三方search 拉剧" },
];

const RUNNING_INFO_POLL_MS = 30_000;
const SEARCH_SAVE_REFRESH_DELAY_MS = 3_000;

type SettingRecord = Record<string, unknown>;

function settingRows(data: unknown): SettingRecord[] {
  if (Array.isArray(data)) {
    return data.filter((item): item is SettingRecord => item != null && typeof item === "object");
  }
  if (data == null || typeof data !== "object") {
    return [];
  }
  const root = data as SettingRecord;
  for (const key of ["data", "items", "list"]) {
    if (Array.isArray(root[key])) {
      return (root[key] as unknown[]).filter(
        (item): item is SettingRecord => item != null && typeof item === "object",
      );
    }
  }
  return [root];
}

function basicSettingRows(data: unknown): BasicSettingRow[] {
  const rows = settingRows(data);
  const looksLikeSettingRows = rows.some((row) => row.key != null || row.name != null || row.slug != null);
  if (looksLikeSettingRows) {
    return rows.flatMap((row, index) => {
      const key = String(row.key ?? row.name ?? row.slug ?? "").trim();
      if (!key) return [];
      return [{
        rowKey: String(row.id ?? key ?? index),
        id: row.id as string | number | undefined,
        key,
        name: String(row.name ?? row.key ?? row.slug ?? key).trim() || key,
        value: row.value ?? row.content ?? row.enabled ?? null,
      }];
    });
  }

  if (data == null || typeof data !== "object" || Array.isArray(data)) return [];
  const root = data as SettingRecord;
  return Object.entries(root).map(([key, value]) => ({
    rowKey: key,
    key,
    name: key,
    value,
  }));
}

function settingValueText(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "string") return value;
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function iosIframeSetting(data: unknown): { id?: string | number; enabled: boolean } {
  const rows = settingRows(data);
  const row = rows.find(
    (item) => String(item.key ?? item.name ?? item.slug ?? "").trim() === IOS_IFRAME_SETTING_KEY,
  );
  const root = data != null && typeof data === "object" && !Array.isArray(data) ? (data as SettingRecord) : null;
  const raw = row?.value ?? row?.content ?? row?.enabled ?? root?.[IOS_IFRAME_SETTING_KEY];
  const normalized = typeof raw === "string" ? raw.trim().toLowerCase() : raw;
  return {
    id: row?.id as string | number | undefined,
    enabled: normalized === true || normalized === 1 || normalized === "1" || normalized === "true" || normalized === "on",
  };
}

function tokenContentFromResponse(data: unknown): string {
  if (typeof data === "string") {
    return data;
  }
  if (data == null) {
    return "";
  }
  return JSON.stringify(data, null, 2);
}

function runningInfoText(data: unknown): string {
  if (data == null || data === "") {
    return "暂无";
  }
  if (typeof data === "string") {
    const value = data.trim();
    if (!value) {
      return "暂无";
    }
    try {
      return JSON.stringify(JSON.parse(value) as unknown, null, 2);
    } catch {
      return value;
    }
  }
  return JSON.stringify(data, null, 2);
}

function ffmpegIdsText(data: unknown): string {
  let parsed = data;
  if (typeof parsed === "string") {
    const raw = parsed;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      return raw.trim() || "暂无";
    }
  }
  const values = Array.isArray(parsed)
    ? parsed
    : parsed != null && typeof parsed === "object" && Array.isArray((parsed as Record<string, unknown>).ffmpeg)
      ? ((parsed as Record<string, unknown>).ffmpeg as unknown[])
      : [];
  const ids = values.map((value) => String(value ?? "").trim()).filter(Boolean);
  return ids.length > 0 ? ids.join(", ") : "暂无";
}

function runningLogRows(data: string): RunningLogRow[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data) as unknown;
  } catch {
    return [];
  }
  if (parsed == null || typeof parsed !== "object") {
    return [];
  }
  const root = parsed as Record<string, unknown>;
  const detail = root.detail != null && typeof root.detail === "object" ? root.detail as Record<string, unknown> : {};
  const backend =
    detail.backend != null && typeof detail.backend === "object"
      ? detail.backend as Record<string, unknown>
      : {};
  const createTime = String(backend.create_time ?? "—");
  const runningTime = String(backend.running_time ?? "—");
  const ids = Array.isArray(root.ffmpeg)
    ? root.ffmpeg.map((value) => String(value ?? "").trim()).filter(Boolean)
    : [];
  const values = ids.length > 0 ? ids : ["—"];
  return values.map((ffmpegId, index) => ({
    key: `${ffmpegId}-${index}`,
    ffmpegId,
    createTime,
    runningTime,
  }));
}

function searchResultRowsFromResponse(data: unknown): SearchResultRow[] {
  let parsed = data;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed) as unknown;
    } catch {
      return [];
    }
  }
  const source = Array.isArray(parsed)
    ? parsed
    : parsed != null && typeof parsed === "object"
      ? ((parsed as Record<string, unknown>).data ??
        (parsed as Record<string, unknown>).results ??
        (parsed as Record<string, unknown>).items)
      : null;
  if (!Array.isArray(source)) {
    return [];
  }
  return source.flatMap((item, index) => {
    if (item == null || typeof item !== "object") {
      return [];
    }
    const row = item as Record<string, unknown>;
    const id = String(row.id ?? "");
    const title = String(row.title ?? row.name ?? "");
    const thumbnailUrl = String(row.thumbnail_url ?? row.thumbnailUrl ?? row.image_url ?? row.image ?? "");
    return [{ key: id || String(index), id, title, thumbnailUrl, raw: row }];
  });
}

export function ConfigManagement() {
  const isYogoSite = getActiveSiteKey() === "main";
  const [activeTab, setActiveTab] = useState("third-party");
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [tokenContent, setTokenContent] = useState("");
  const [loadingToken, setLoadingToken] = useState(false);
  const [savingToken, setSavingToken] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchTitle, setSearchTitle] = useState("");
  const [searchContent, setSearchContent] = useState("");
  const [searchRows, setSearchRows] = useState<SearchResultRow[]>([]);
  const [selectedSearchKey, setSelectedSearchKey] = useState<string | null>(null);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [savingSearch, setSavingSearch] = useState(false);
  const [searchLoaded, setSearchLoaded] = useState(false);
  const [ffmpegInfo, setFfmpegInfo] = useState("暂无");
  const [loadingFfmpegInfo, setLoadingFfmpegInfo] = useState(false);
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [allLogs, setAllLogs] = useState("暂无日志");
  const [loadingAllLogs, setLoadingAllLogs] = useState(false);
  const [ffmpegRestartSeq, setFfmpegRestartSeq] = useState(0);
  const [ffmpegRestartPaused, setFfmpegRestartPaused] = useState(false);
  const [iosIframesId, setIosIframesId] = useState<string | number>();
  const [iosIframesEnabled, setIosIframesEnabled] = useState(false);
  const [basicSettings, setBasicSettings] = useState<BasicSettingRow[]>([]);
  const [loadingIosIframes, setLoadingIosIframes] = useState(false);
  const [savingIosIframes, setSavingIosIframes] = useState(false);

  const ffmpegRequestRef = useRef<Promise<string> | null>(null);
  const allLogsRequestRef = useRef<Promise<string> | null>(null);
  const ffmpegRestartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadIosIframes = useCallback(async () => {
    setLoadingIosIframes(true);
    try {
      const res = await apiGet<unknown>("admin/settings");
      if (res.c !== 0) {
        message.error(res.m || "获取 ios_iframe 配置失败");
        return;
      }
      setBasicSettings(basicSettingRows(res.d));
      const setting = iosIframeSetting(res.d);
      setIosIframesId(setting.id);
      setIosIframesEnabled(setting.enabled);
    } catch {
      message.error("获取 ios_iframe 配置失败");
    } finally {
      setLoadingIosIframes(false);
    }
  }, []);

  useEffect(() => {
    if (isYogoSite) {
      void loadIosIframes();
    }
  }, [isYogoSite, loadIosIframes]);

  const saveIosIframes = useCallback(
    async (enabled: boolean) => {
      setSavingIosIframes(true);
      try {
        const res = await apiPostJson<unknown>("admin/settings", {
          ...(iosIframesId == null ? {} : { id: iosIframesId }),
          key: IOS_IFRAME_SETTING_KEY,
          name: IOS_IFRAME_SETTING_KEY,
          value: enabled ? 1 : 0,
        });
        if (res.c !== 0) {
          message.error(res.m || "保存 ios_iframe 配置失败");
          return;
        }
        const saved = iosIframeSetting(res.d);
        if (saved.id != null) {
          setIosIframesId(saved.id);
        }
        setIosIframesEnabled(enabled);
        setBasicSettings((current) => current.map((row) => (
          row.key === IOS_IFRAME_SETTING_KEY ? { ...row, value: enabled ? 1 : 0 } : row
        )));
        message.success(`ios_iframe 已${enabled ? "开启" : "关闭"}`);
      } catch {
        message.error("保存 ios_iframe 配置失败");
      } finally {
        setSavingIosIframes(false);
      }
    },
    [iosIframesId],
  );

  const requestRunningInfo = useCallback((type: "all" | "ffmpeg"): Promise<string> => {
    const requestRef = type === "ffmpeg" ? ffmpegRequestRef : allLogsRequestRef;
    if (requestRef.current) {
      return requestRef.current;
    }
    const request = apiPostJson<unknown>("admin/drama/running-info", { type })
      .then((res) => {
        if (res.c !== 0) {
          throw new Error(res.m || "获取运行信息失败");
        }
        return type === "ffmpeg" ? ffmpegIdsText(res.d) : runningInfoText(res.d);
      })
      .finally(() => {
        requestRef.current = null;
      });
    requestRef.current = request;
    return request;
  }, []);

  useEffect(() => {
    if (!isYogoSite || activeTab !== "third-party" || logsModalOpen || ffmpegRestartPaused) {
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      setLoadingFfmpegInfo(true);
      try {
        const text = await requestRunningInfo("ffmpeg");
        if (!cancelled) {
          setFfmpegInfo(text);
        }
      } catch (error) {
        if (!cancelled) {
          setFfmpegInfo(error instanceof Error ? `加载失败：${error.message}` : "加载失败");
        }
      } finally {
        if (!cancelled) {
          setLoadingFfmpegInfo(false);
          timer = setTimeout(() => void poll(), RUNNING_INFO_POLL_MS);
        }
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [activeTab, ffmpegRestartPaused, ffmpegRestartSeq, isYogoSite, logsModalOpen, requestRunningInfo]);

  useEffect(() => {
    if (!isYogoSite || activeTab !== "third-party" || !logsModalOpen) {
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      setLoadingAllLogs(true);
      try {
        const text = await requestRunningInfo("all");
        if (!cancelled) {
          setAllLogs(text);
        }
      } catch (error) {
        if (!cancelled) {
          setAllLogs(error instanceof Error ? `加载失败：${error.message}` : "加载失败");
        }
      } finally {
        if (!cancelled) {
          setLoadingAllLogs(false);
          timer = setTimeout(() => void poll(), RUNNING_INFO_POLL_MS);
        }
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [activeTab, isYogoSite, logsModalOpen, requestRunningInfo]);

  useEffect(
    () => () => {
      if (ffmpegRestartTimerRef.current) {
        clearTimeout(ffmpegRestartTimerRef.current);
      }
    },
    [],
  );

  const clearFfmpegRestartTimer = useCallback(() => {
    if (ffmpegRestartTimerRef.current) {
      clearTimeout(ffmpegRestartTimerRef.current);
      ffmpegRestartTimerRef.current = null;
    }
  }, []);

  const scheduleFfmpegRefreshAfterSave = useCallback(() => {
    clearFfmpegRestartTimer();
    setFfmpegRestartPaused(true);
    ffmpegRestartTimerRef.current = setTimeout(() => {
      ffmpegRestartTimerRef.current = null;
      setFfmpegRestartPaused(false);
      setFfmpegRestartSeq((value) => value + 1);
    }, SEARCH_SAVE_REFRESH_DELAY_MS);
  }, [clearFfmpegRestartTimer]);

  const openLogsModal = useCallback(() => {
    clearFfmpegRestartTimer();
    setFfmpegRestartPaused(false);
    setLogsModalOpen(true);
  }, [clearFfmpegRestartTimer]);

  const closeLogsModal = useCallback(() => {
    clearFfmpegRestartTimer();
    setFfmpegRestartPaused(false);
    setLogsModalOpen(false);
  }, [clearFfmpegRestartTimer]);

  const changeActiveTab = useCallback(
    (key: string) => {
      if (key !== "third-party") {
        clearFfmpegRestartTimer();
        setFfmpegRestartPaused(false);
        setLogsModalOpen(false);
      }
      setActiveTab(key);
    },
    [clearFfmpegRestartTimer],
  );

  const openTokenModal = useCallback(async () => {
    setTokenModalOpen(true);
    setLoadingToken(true);
    try {
      const res = await apiPostJson<unknown>("admin/drama/info", { name: "snack" });
      if (res.c !== 0) {
        message.error(res.m || "获取三方token信息失败");
        setTokenContent("");
        return;
      }
      setTokenContent(tokenContentFromResponse(res.d));
    } catch {
      message.error("获取三方token信息失败");
      setTokenContent("");
    } finally {
      setLoadingToken(false);
    }
  }, []);

  const saveToken = useCallback(async () => {
    const content = tokenContent.trim();
    if (!content) {
      message.warning("请粘贴 refresh-token 接口返回的完整 JSON 数据");
      return;
    }
    setSavingToken(true);
    try {
      const res = await apiPostJson<unknown>("admin/drama/save", { name: "token", content });
      if (res.c !== 0) {
        message.error(res.m || "保存三方token信息失败");
        return;
      }
      message.success("三方token信息保存成功");
      setTokenModalOpen(false);
    } catch {
      message.error("保存三方token信息失败");
    } finally {
      setSavingToken(false);
    }
  }, [tokenContent]);

  const openSearchModal = useCallback(() => {
    setSearchTitle("");
    setSearchContent("");
    setSearchRows([]);
    setSelectedSearchKey(null);
    setSearchLoaded(false);
    setSearchModalOpen(true);
  }, []);

  const loadSearch = useCallback(async () => {
    const title = searchTitle;
    setSearchLoaded(false);
    setSelectedSearchKey(null);
    setSearchContent("");
    setSearchRows([]);
    setLoadingSearch(true);
    try {
      const res = await apiPostJson<unknown>("admin/drama/search", { title });
      if (res.c !== 0) {
        message.error(res.m || "获取三方search失败");
        setSearchContent("");
        return;
      }
      setSearchRows(searchResultRowsFromResponse(res.d));
      setSearchLoaded(true);
    } catch {
      message.error("获取三方search失败");
      setSearchContent("");
    } finally {
      setLoadingSearch(false);
    }
  }, [searchTitle]);

  const saveSearch = useCallback(async () => {
    if (!searchLoaded || selectedSearchKey == null) {
      return;
    }
    const content = searchContent.trim();
    if (!content) {
      message.warning("请输入三方search信息");
      return;
    }
    setSavingSearch(true);
    try {
      const res = await apiPostJson<unknown>("admin/drama/save", { name: "search", content });
      if (res.c !== 0) {
        message.error(res.m || "保存三方search失败");
        return;
      }
      message.success("三方search保存成功");
      scheduleFfmpegRefreshAfterSave();
      setSearchModalOpen(false);
    } catch {
      message.error("保存三方search失败");
    } finally {
      setSavingSearch(false);
    }
  }, [scheduleFfmpegRefreshAfterSave, searchContent, searchLoaded, selectedSearchKey]);

  const columns: ColumnsType<ConfigRow> = [
    { title: "配置项", dataIndex: "name", key: "name" },
    {
      title: "操作",
      key: "action",
      width: 120,
      render: (_, row) => (
        <Button
          type="link"
          onClick={() => void (row.key === SEARCH_CONFIG_KEY ? openSearchModal() : openTokenModal())}
        >
          配置
        </Button>
      ),
    },
  ];

  const basicConfigColumns: ColumnsType<BasicSettingRow> = [
    {
      title: "配置项",
      dataIndex: "key",
      key: "key",
      width: 260,
      render: (key: string, row) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <Typography.Text copyable={{ text: key }}>{key}</Typography.Text>
          {row.name !== key ? <Typography.Text type="secondary">{row.name}</Typography.Text> : null}
        </div>
      ),
    },
    {
      title: "配置值",
      key: "value",
      render: (_, row) => row.key === IOS_IFRAME_SETTING_KEY ? (
          <Switch
            checked={iosIframesEnabled}
            checkedChildren="开启"
            unCheckedChildren="关闭"
            loading={loadingIosIframes || savingIosIframes}
            disabled={loadingIosIframes || savingIosIframes}
            onChange={(checked) => void saveIosIframes(checked)}
          />
        ) : (
          <Typography.Text
            copyable={row.value == null || row.value === "" ? false : { text: settingValueText(row.value) }}
            style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
          >
            {settingValueText(row.value)}
          </Typography.Text>
        ),
    },
  ];

  const searchColumns: ColumnsType<SearchResultRow> = [
    {
      title: "名称",
      dataIndex: "title",
      key: "title",
      width: 260,
      render: (title: string) =>
        title ? <Typography.Text copyable={{ text: title }}>{title}</Typography.Text> : "—",
    },
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      width: 300,
      render: (id: string) => (id ? <Typography.Text copyable={{ text: id }}>{id}</Typography.Text> : "—"),
    },
    {
      title: "图片地址",
      dataIndex: "thumbnailUrl",
      key: "thumbnailUrl",
      render: (url: string) =>
        url ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <Typography.Text
              copyable={{ text: url }}
              ellipsis={{ tooltip: url }}
              style={{ flex: 1, minWidth: 0 }}
            >
              {url}
            </Typography.Text>
            <Typography.Link href={url} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0 }}>
              新窗口查看
            </Typography.Link>
          </div>
        ) : (
          "—"
        ),
    },
  ];

  const allLogRows = runningLogRows(allLogs);

  return (
    <div>
      <Typography.Title level={4}>配置管理</Typography.Title>
      <Tabs
        activeKey={activeTab}
        onChange={changeActiveTab}
        items={[
          {
            key: "third-party",
            label: "三方配置",
            children: (
              <>
                {isYogoSite ? (
                  <div
                    style={{
                      marginBottom: 16,
                      padding: "12px 16px",
                      border: "1px solid #e8e8e8",
                      borderRadius: 6,
                      background: "#fafafa",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <Typography.Text strong style={{ flexShrink: 0 }}>
                        抓取 FFmpeg ID：
                      </Typography.Text>
                      <Typography.Text
                        copyable={ffmpegInfo && ffmpegInfo !== "暂无" ? { text: ffmpegInfo } : false}
                        style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                      >
                        {loadingFfmpegInfo && ffmpegInfo === "暂无" ? "加载中..." : ffmpegInfo}
                      </Typography.Text>
                    </div>
                    <Button
                      type="link"
                      style={{ height: "auto", marginTop: 8, padding: 0 }}
                      onClick={openLogsModal}
                    >
                      抓取详情日志
                    </Button>
                  </div>
                ) : null}
                <Table<ConfigRow>
                  rowKey="key"
                  columns={columns}
                  dataSource={isYogoSite ? CONFIG_ROWS : []}
                  pagination={false}
                  bordered
                />
              </>
            ),
          },
          ...(isYogoSite
            ? [
                {
                  key: "basic-config",
                  label: "基础配置",
                  children: (
                    <Table<BasicSettingRow>
                      rowKey="rowKey"
                      columns={basicConfigColumns}
                      dataSource={basicSettings}
                      loading={loadingIosIframes}
                      pagination={false}
                      bordered
                    />
                  ),
                },
              ]
            : []),
        ]}
      />

      <Modal
        title="三方token信息"
        open={tokenModalOpen}
        width={800}
        okText="保存"
        cancelText="取消"
        confirmLoading={savingToken}
        okButtonProps={{ disabled: loadingToken }}
        onOk={() => void saveToken()}
        onCancel={() => setTokenModalOpen(false)}
        destroyOnClose
      >
        <Typography.Paragraph type="secondary">
          请复制 Snack /refresh-token 接口在 Network 中返回的完整 Response JSON，并原样粘贴到下方。
        </Typography.Paragraph>
        <Input.TextArea
          value={tokenContent}
          onChange={(event) => setTokenContent(event.target.value)}
          placeholder="粘贴完整的 JSON Response"
          autoSize={{ minRows: 10, maxRows: 20 }}
          disabled={loadingToken}
        />
        {loadingToken ? <Typography.Text type="secondary">正在获取已保存信息...</Typography.Text> : null}
      </Modal>

      <Modal
        title="三方search 拉剧"
        open={searchModalOpen}
        width="min(900px, calc(100vw - 32px))"
        styles={{ body: { maxHeight: "68vh", overflowY: "auto" } }}
        okText="保存"
        cancelText="取消"
        confirmLoading={savingSearch}
        okButtonProps={{
          disabled: loadingSearch,
          style: { display: selectedSearchKey != null ? undefined : "none" },
        }}
        onOk={() => void saveSearch()}
        onCancel={() => setSearchModalOpen(false)}
        destroyOnClose
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Input
            value={searchTitle}
            onChange={(event) => {
              setSearchTitle(event.target.value);
              setSearchLoaded(false);
              setSelectedSearchKey(null);
              setSearchContent("");
              setSearchRows([]);
            }}
            onPressEnter={() => void loadSearch()}
            placeholder="请输入标题"
            disabled={loadingSearch || savingSearch}
          />
          <Button loading={loadingSearch} disabled={savingSearch} onClick={() => void loadSearch()}>
            查询
          </Button>
        </div>
        <Table<SearchResultRow>
          rowKey="key"
          columns={searchColumns}
          dataSource={searchRows}
          rowSelection={{
            type: "radio",
            selectedRowKeys: selectedSearchKey == null ? [] : [selectedSearchKey],
            onChange: (selectedRowKeys) => {
              const key = selectedRowKeys[0] == null ? null : String(selectedRowKeys[0]);
              setSelectedSearchKey(key);
              const selectedRow = key == null ? null : searchRows.find((row) => row.key === key);
              setSearchContent(selectedRow ? JSON.stringify(selectedRow.raw, null, 2) : "");
            },
          }}
          loading={loadingSearch}
          pagination={{ pageSize: 8, showSizeChanger: false }}
          scroll={{ x: 820, y: 220 }}
          locale={{ emptyText: searchLoaded ? "暂无查询结果" : "请先查询" }}
          size="small"
          bordered
        />
        <Typography.Text strong style={{ display: "block", marginTop: 16, marginBottom: 8 }}>
          Content
        </Typography.Text>
        <Input.TextArea
          value={searchContent}
          onChange={(event) => setSearchContent(event.target.value)}
          placeholder="查询后展示完整 content"
          autoSize={{ minRows: 4, maxRows: 8 }}
          disabled={loadingSearch}
        />
      </Modal>

      <Modal
        title={<span style={{ color: "#f0f6fc" }}>抓取详情日志</span>}
        open={logsModalOpen}
        width="min(900px, calc(100vw - 32px))"
        footer={null}
        closeIcon={<span style={{ color: "#f0f6fc", fontSize: 20 }}>×</span>}
        onCancel={closeLogsModal}
        destroyOnClose
        styles={{
          content: { background: "#0d1117" },
          header: { background: "#0d1117", borderBottom: "1px solid #30363d" },
          body: { paddingTop: 16, background: "#0d1117" },
        }}
      >
        <div style={{ marginBottom: 8, color: "#8b949e", fontSize: 12 }}>
          {loadingAllLogs ? "正在刷新..." : "每 30 秒自动刷新"}
        </div>
        <div style={{ maxHeight: "62vh", overflow: "auto", border: "1px solid #30363d", borderRadius: 6 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", color: "#e6edf3", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#161b22" }}>
                <th style={{ padding: "10px 12px", borderBottom: "1px solid #30363d", textAlign: "left" }}>
                  FFmpeg ID
                </th>
                <th style={{ padding: "10px 12px", borderBottom: "1px solid #30363d", textAlign: "left" }}>
                  创建时间
                </th>
                <th style={{ padding: "10px 12px", borderBottom: "1px solid #30363d", textAlign: "left" }}>
                  运行时间
                </th>
              </tr>
            </thead>
            <tbody>
              {allLogRows.map((row) => (
                <tr key={row.key} style={{ background: "#010409" }}>
                  <td
                    style={{
                      padding: "10px 12px",
                      borderBottom: "1px solid #21262d",
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {row.ffmpegId}
                  </td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #21262d" }}>{row.createTime}</td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #21262d" }}>{row.runningTime}</td>
                </tr>
              ))}
              {allLogRows.length === 0 ? (
                <tr style={{ background: "#010409" }}>
                  <td colSpan={3} style={{ padding: 24, color: "#8b949e", textAlign: "center" }}>
                    {loadingAllLogs ? "加载中..." : "暂无日志"}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  );
}
