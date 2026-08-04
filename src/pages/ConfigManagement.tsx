import { useCallback, useState } from "react";
import { Button, Input, Modal, Table, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { apiPostJson } from "@/api/client";
import { getActiveSiteKey } from "@/api/baseURL";

type ConfigRow = {
  key: string;
  name: string;
};

type SearchResultRow = {
  key: string;
  id: string;
  title: string;
  thumbnailUrl: string;
  raw: Record<string, unknown>;
};

const TOKEN_CONFIG_KEY = "third-party-token";
const SEARCH_CONFIG_KEY = "third-party-search";

const CONFIG_ROWS: ConfigRow[] = [
  { key: TOKEN_CONFIG_KEY, name: "三方token信息" },
  { key: SEARCH_CONFIG_KEY, name: "三方search 拉剧" },
];

function tokenContentFromResponse(data: unknown): string {
  if (typeof data === "string") {
    return data;
  }
  if (data == null) {
    return "";
  }
  return JSON.stringify(data, null, 2);
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
      setSearchModalOpen(false);
    } catch {
      message.error("保存三方search失败");
    } finally {
      setSavingSearch(false);
    }
  }, [searchContent, searchLoaded, selectedSearchKey]);

  const columns: ColumnsType<ConfigRow> = [
    { title: "配置项", dataIndex: "name", key: "name" },
    {
      title: "操作",
      key: "action",
      width: 120,
      render: (_, row) =>
        <Button
          type="link"
          onClick={() => void (row.key === SEARCH_CONFIG_KEY ? openSearchModal() : openTokenModal())}
        >
            配置
        </Button>,
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

  return (
    <div>
      <Typography.Title level={4}>配置管理</Typography.Title>
      <Table<ConfigRow>
        rowKey="key"
        columns={columns}
        dataSource={isYogoSite ? CONFIG_ROWS : []}
        pagination={false}
        bordered
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
    </div>
  );
}
