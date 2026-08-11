import { useCallback, useEffect, useRef, useState, type UIEvent } from "react";
import {
  Button,
  Descriptions,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Typography,
  message,
} from "antd";
import { DownOutlined, UpOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { apiGet, apiPostJson, getApiErrorMessage } from "@/api/client";
import type { ApiResult } from "@/api/types";
import { useAppStaticBase } from "@/config/AppConfigContext";
import { movieCoverUrl } from "@/lib/staticAssetOrigin";
import { rowsFromSourceListPayload } from "@/lib/adminSourceList";
import type { AdminMovieListPayload, AdminMovieRow } from "@/types/adminMovie";
import styles from "./TikTokMinisLinkMock.module.css";

type TikTokAdRow = {
  id: number;
  name: string;
  ad_id: string;
  enabled: boolean;
};

type TikTokAdListPayload = {
  data?: TikTokAdRow[];
};

type MinisLinkRow = {
  id: number;
  ad_config_id: number;
  movie_id?: number | null;
  source_id?: number | null;
  minis_path: string;
  title?: string | null;
  image_url?: string | null;
  remark: string;
  minis_link: string;
  created_at?: string;
  updated_at?: string;
};

type MinisLinkListPayload = {
  data?: MinisLinkRow[];
  current_page?: number;
  per_page?: number;
  count?: number;
};

type TikTokSourceOption = {
  value: number;
  label: string;
  source: string;
};

type AddValues = {
  adRecordId: number;
  movieId?: number;
  sourceId?: number;
  title?: string;
  imageUrl?: string;
  remark: string;
};

type EditValues = Pick<AddValues, "remark">;

function buildMinisPath(
  ads: TikTokAdRow[],
  sources: TikTokSourceOption[],
  movieId?: number,
  adRecordId?: number,
  sourceId?: number,
): string {
  const pathname = movieId ? `/video/${movieId}/1` : "/";
  const adUnitId = ads.find((ad) => ad.id === adRecordId)?.ad_id;
  const params = new URLSearchParams();
  const normalizedSource = sources.find((source) => source.value === sourceId)?.source.trim();
  if (normalizedSource) params.set("s", normalizedSource);
  if (adUnitId) params.set("ad_unit_id", adUnitId);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function TikTokMinisLinkMock() {
  const staticBase = useAppStaticBase();
  const [addForm] = Form.useForm<AddValues>();
  const [editForm] = Form.useForm<EditValues>();
  const [rows, setRows] = useState<MinisLinkRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(24);
  const [total, setTotal] = useState(0);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addOptionalOpen, setAddOptionalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<MinisLinkRow | null>(null);
  const [movieRows, setMovieRows] = useState<AdminMovieRow[]>([]);
  const [movieTotal, setMovieTotal] = useState(0);
  const [moviePage, setMoviePage] = useState(1);
  const [movieKeyword, setMovieKeyword] = useState("");
  const [movieLoading, setMovieLoading] = useState(false);
  const [adRows, setAdRows] = useState<TikTokAdRow[]>([]);
  const [adLoading, setAdLoading] = useState(false);
  const [sourceOptions, setSourceOptions] = useState<TikTokSourceOption[]>([]);
  const [sourceLoading, setSourceLoading] = useState(false);
  const movieLoadingRef = useRef(false);
  const movieRequestIdRef = useRef(0);
  const movieSearchTimerRef = useRef<number | null>(null);
  const selectedAdRecordId = Form.useWatch("adRecordId", addForm);
  const selectedMovieId = Form.useWatch("movieId", addForm);
  const selectedSourceId = Form.useWatch("sourceId", addForm);
  const minisPath = buildMinisPath(adRows, sourceOptions, selectedMovieId, selectedAdRecordId, selectedSourceId);

  const fetchLinks = useCallback(async (targetPage: number) => {
    setListLoading(true);
    try {
      const res = await apiGet<MinisLinkListPayload>("admin/tiktok/minis/link/list", { page: targetPage });
      if (res.c !== 0) {
        message.error(getApiErrorMessage(res, "Minis Link 列表加载失败"));
        return;
      }
      const data = Array.isArray(res.d?.data) ? res.d.data : [];
      setRows(data);
      setPage(Number(res.d?.current_page) || targetPage);
      setPerPage(Number(res.d?.per_page) || 24);
      setTotal(Number(res.d?.count) || 0);
    } catch {
      message.error("Minis Link 列表加载失败，请检查网络或接口配置");
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLinks(page);
  }, [fetchLinks, page]);

  useEffect(() => {
    let cancelled = false;
    setAdLoading(true);
    void apiGet<TikTokAdListPayload>("admin/tiktok-ads", { page: 1 })
      .then((res) => {
        if (cancelled) return;
        if (res.c !== 0) {
          message.error(res.m || "加载 TikTok 广告位失败");
          setAdRows([]);
          return;
        }
        const ads = (Array.isArray(res.d?.data) ? res.d.data : [])
          .map((row) => ({ ...row, enabled: Boolean(row.enabled) }));
        setAdRows(ads);
      })
      .catch(() => {
        if (!cancelled) {
          message.error("加载 TikTok 广告位失败，请检查网络或接口配置");
          setAdRows([]);
        }
      })
      .finally(() => {
        if (!cancelled) setAdLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchMovies = useCallback(async (targetPage: number, targetKeyword = "", append = false) => {
    if (append && movieLoadingRef.current) return;
    const requestId = ++movieRequestIdRef.current;
    movieLoadingRef.current = true;
    setMovieLoading(true);
    try {
      const res: ApiResult<AdminMovieListPayload> = await apiGet("admin/movie/list", {
        page: targetPage,
        keyword: targetKeyword,
        language: "all",
      });
      if (requestId !== movieRequestIdRef.current) return;
      if (res.c !== 0) {
        message.error(res.m || "加载剧集失败");
        if (!append) {
          setMovieRows([]);
          setMovieTotal(0);
        }
        return;
      }
      const nextRows = Array.isArray(res.d?.data) ? res.d.data : [];
      setMovieRows((current) => {
        if (!append) return nextRows;
        const rowMap = new Map(current.map((row) => [row.id, row]));
        nextRows.forEach((row) => rowMap.set(row.id, row));
        return Array.from(rowMap.values());
      });
      setMovieTotal(Number(res.d?.count) || 0);
      setMoviePage(Number(res.d?.current_page) || targetPage);
    } catch {
      if (requestId !== movieRequestIdRef.current) return;
      message.error("加载剧集失败，请检查网络或接口配置");
      if (!append) {
        setMovieRows([]);
        setMovieTotal(0);
      }
    } finally {
      if (requestId === movieRequestIdRef.current) {
        movieLoadingRef.current = false;
        setMovieLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchMovies(1);
    return () => {
      if (movieSearchTimerRef.current) window.clearTimeout(movieSearchTimerRef.current);
    };
  }, [fetchMovies]);

  useEffect(() => {
    let cancelled = false;
    setSourceLoading(true);
    void apiGet<unknown>("admin/source/list", { type: "tiktok" })
      .then((res) => {
        if (cancelled) return;
        if (res.c !== 0) {
          message.error(res.m || "加载 TikTok 来源失败");
          setSourceOptions([]);
          return;
        }
        const options = rowsFromSourceListPayload(res.d)
          .filter((row) => row.type === "tiktok" && Number(row.status) === 1 && row.source?.trim())
          .map((row) => ({
            value: row.id,
            label: row.source_id?.trim() ? `${row.source.trim()}（${row.source_id.trim()}）` : row.source.trim(),
            source: row.source.trim(),
          }));
        setSourceOptions(options);
      })
      .catch(() => {
        if (!cancelled) {
          message.error("加载 TikTok 来源失败，请检查网络或接口配置");
          setSourceOptions([]);
        }
      })
      .finally(() => {
        if (!cancelled) setSourceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const searchMovies = useCallback((value: string) => {
    if (movieSearchTimerRef.current) window.clearTimeout(movieSearchTimerRef.current);
    movieSearchTimerRef.current = window.setTimeout(() => {
      const keyword = value.trim();
      setMovieKeyword(keyword);
      setMovieRows([]);
      setMovieTotal(0);
      setMoviePage(1);
      void fetchMovies(1, keyword);
    }, 350);
  }, [fetchMovies]);

  const loadMoreMovies = useCallback((event: UIEvent<HTMLDivElement>) => {
    const popup = event.currentTarget;
    const reachedBottom = popup.scrollTop + popup.clientHeight >= popup.scrollHeight - 24;
    if (reachedBottom && !movieLoadingRef.current && movieRows.length < movieTotal) {
      void fetchMovies(moviePage + 1, movieKeyword, true);
    }
  }, [fetchMovies, movieKeyword, moviePage, movieRows.length, movieTotal]);

  const openAdd = () => {
    addForm.resetFields();
    const defaultAd = adRows.find((ad) => ad.enabled && ad.name.includes("默认"));
    addForm.setFieldsValue({ adRecordId: defaultAd?.id, remark: "" });
    setAddOptionalOpen(false);
    setAddOpen(true);
  };

  const saveAdd = async () => {
    let values: AddValues;
    try {
      values = await addForm.validateFields();
    } catch {
      return;
    }
    setSaving(true);
    try {
      const res = await apiPostJson<MinisLinkRow>("admin/tiktok/minis/link/save", {
        ad_config_id: values.adRecordId,
        movie_id: values.movieId ?? null,
        source_id: values.sourceId ?? null,
        minis_path: minisPath,
        title: values.title?.trim() || "",
        image_url: values.imageUrl?.trim() || "",
        remark: values.remark.trim(),
      });
      if (res.c !== 0) {
        message.error(getApiErrorMessage(res, "生成 Minis Link 失败"));
        return;
      }
      setAddOpen(false);
      message.success("Minis Link 生成成功");
      if (page === 1) await fetchLinks(1);
      else setPage(1);
    } catch {
      message.error("生成 Minis Link 失败，请检查网络或接口配置");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = async (row: MinisLinkRow) => {
    try {
      const res = await apiGet<MinisLinkRow>("admin/tiktok/minis/link/info", { id: row.id });
      if (res.c !== 0 || !res.d) {
        message.error(getApiErrorMessage(res, "Minis Link 详情加载失败"));
        return;
      }
      const detail = res.d;
      setEditingRow(detail);
      editForm.setFieldsValue({
        remark: detail.remark || "",
      });
      if (detail.movie_id && !movieRows.some((movie) => movie.id === detail.movie_id)) {
        void fetchMovies(1, String(detail.movie_id));
      }
    } catch {
      message.error("Minis Link 详情加载失败，请检查网络或接口配置");
    }
  };

  const saveEdit = async () => {
    if (!editingRow) return;
    let values: EditValues;
    try {
      values = await editForm.validateFields();
    } catch {
      return;
    }
    setSaving(true);
    try {
      const res = await apiPostJson<MinisLinkRow>("admin/tiktok/minis/link/save", {
        id: editingRow.id,
        ad_config_id: editingRow.ad_config_id,
        movie_id: editingRow.movie_id ?? null,
        source_id: editingRow.source_id ?? null,
        minis_path: editingRow.minis_path,
        title: editingRow.title || "",
        image_url: editingRow.image_url || "",
        remark: values.remark.trim(),
      });
      if (res.c !== 0) {
        message.error(getApiErrorMessage(res, "Minis Link 保存失败"));
        return;
      }
      setEditingRow(null);
      message.success("Minis Link 保存成功");
      await fetchLinks(page);
    } catch {
      message.error("Minis Link 保存失败，请检查网络或接口配置");
    } finally {
      setSaving(false);
    }
  };

  const deleteLink = async (row: MinisLinkRow) => {
    try {
      const res = await apiPostJson<unknown>("admin/tiktok/minis/link/delete", { id: row.id });
      if (res.c !== 0) {
        message.error(getApiErrorMessage(res, "Minis Link 删除失败"));
        return;
      }
      message.success("Minis Link 删除成功");
      const nextPage = rows.length === 1 && page > 1 ? page - 1 : page;
      if (nextPage === page) await fetchLinks(page);
      else setPage(nextPage);
    } catch {
      message.error("Minis Link 删除失败，请检查网络或接口配置");
    }
  };

  const columns: ColumnsType<MinisLinkRow> = [
    {
      title: "Minis Link",
      key: "minisLink",
      width: 420,
      render: (_, row) => {
        const path = row.minis_path;
        return (
          <div className={styles.multilineCell}>
            <div className={styles.infoLine}>
              <span className={styles.infoLabel}>URL：</span>
              <div className={styles.urlCell}>
                <Typography.Link
                  className={styles.urlText}
                  href={row.minis_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  ellipsis
                >
                  {row.minis_link}
                </Typography.Link>
                <Typography.Text copyable={{ text: row.minis_link }} />
              </div>
            </div>
            <div className={styles.infoLine}>
              <span className={styles.infoLabel}>Path：</span>
              <Typography.Text ellipsis={{ tooltip: path }}>
                {path}
              </Typography.Text>
            </div>
          </div>
        );
      },
    },
    {
      title: "关联信息",
      key: "relations",
      width: 340,
      render: (_, row) => (
        <div className={styles.multilineCell}>
          {row.source_id ? (
            <div className={styles.infoLine}><span className={styles.infoLabel}>来源：</span><span>{sourceDisplayName(row.source_id)}</span></div>
          ) : null}
          {row.movie_id ? (
            <div className={styles.infoLine}><span className={styles.infoLabel}>剧集：</span><span>{movieTitle(row.movie_id)}</span></div>
          ) : null}
          <div className={styles.infoLine}><span className={styles.infoLabel}>广告位：</span><span>{adDisplayName(row.ad_config_id)}</span></div>
        </div>
      ),
    },
    {
      title: "备注",
      dataIndex: "remark",
      key: "remark",
      width: 190,
      ellipsis: true,
    },
    {
      title: "操作",
      key: "action",
      width: 120,
      fixed: "right",
      render: (_, row) => (
        <Space size={4}>
          <Button type="link" size="small" onClick={() => void openEdit(row)}>
            编辑
          </Button>
          <Popconfirm
            title="确定删除该 Minis Link 吗？"
            description="这里只删除后台记录，已经发送的链接可能仍然有效。"
            okText="删除"
            cancelText="取消"
            onConfirm={() => void deleteLink(row)}
          >
            <Button type="link" danger size="small">
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const adDisplayName = (adRecordId: number): string => {
    const ad = adRows.find((item) => item.id === adRecordId);
    return ad ? `${ad.name}（${ad.ad_id}）` : String(adRecordId);
  };
  const sourceDisplayName = (sourceId: number): string =>
    sourceOptions.find((source) => source.value === sourceId)?.source ?? String(sourceId);
  const adOptions = adRows
    .filter((ad) => ad.enabled)
    .map((ad) => ({ value: ad.id, label: `${ad.name}（${ad.ad_id}）` }));
  const movieOptions = movieRows.map((movie) => ({ value: movie.id, label: `${movie.id} · ${movie.title || "未命名短剧"}` }));
  const movieTitle = (movieId?: number) => {
    if (movieId == null) return "";
    const movie = movieRows.find((item) => item.id === movieId);
    return movie ? `${movie.id} · ${movie.title || "未命名短剧"}` : String(movieId);
  };

  const renderMovieOption = (option: { value?: unknown; label?: React.ReactNode }) => {
    const movie = movieRows.find((row) => row.id === Number(option.value));
    if (!movie) return option.label;
    const cover = movieCoverUrl(movie, staticBase);
    return (
      <div className={styles.movieOption}>
        {cover ? (
          <img className={styles.movieCover} src={cover} alt="" />
        ) : (
          <div className={styles.movieCoverEmpty}>无封面</div>
        )}
        <div className={styles.movieOptionTitle}>{movie.id} · {movie.title || "未命名短剧"}</div>
      </div>
    );
  };

  const moviePopupRender = (menu: React.ReactNode) => (
    <div>
      {menu}
      {movieLoading && movieRows.length > 0 ? (
        <div className={styles.movieLoading}><Spin size="small" /><span>加载更多…</span></div>
      ) : null}
    </div>
  );

  return (
    <div>
      <div className={styles.toolbar}>
        <Button type="primary" onClick={openAdd}>
          新增链接
        </Button>
      </div>

      <Table<MinisLinkRow>
        className={styles.compactTable}
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={listLoading}
        bordered
        size="small"
        scroll={{ x: 1070 }}
        pagination={{
          current: page,
          pageSize: perPage,
          total,
          showSizeChanger: false,
          onChange: setPage,
        }}
      />

      <Modal
        title="新增 TikTok Minis Link"
        open={addOpen}
        width={680}
        okText="生成 Minis Link"
        cancelText="取消"
        confirmLoading={saving}
        onOk={() => void saveAdd()}
        onCancel={() => setAddOpen(false)}
        destroyOnHidden
      >
        <Form<AddValues> form={addForm} layout="vertical" requiredMark="optional">
          <Form.Item name="adRecordId" label="关联广告位" rules={[{ required: true, message: "请选择关联广告位" }]}>
            <Select options={adOptions} loading={adLoading} placeholder="请选择广告位" />
          </Form.Item>
          <Form.Item name="movieId" label="关联剧">
            <Select
              options={movieOptions}
              placeholder="搜索并选择剧集（短剧名称 / ID）"
              showSearch
              allowClear
              virtual={false}
              filterOption={false}
              loading={movieLoading}
              onSearch={searchMovies}
              onPopupScroll={loadMoreMovies}
              optionRender={renderMovieOption}
              notFoundContent={movieLoading ? <Spin size="small" /> : "暂无符合条件的剧集"}
              popupRender={moviePopupRender}
            />
          </Form.Item>
          <Form.Item name="sourceId" label="来源">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              loading={sourceLoading}
              options={sourceOptions}
              placeholder="请选择 TikTok 推广来源"
              notFoundContent={sourceLoading ? <Spin size="small" /> : "暂无 TikTok 推广来源"}
            />
          </Form.Item>
          <Form.Item label="Minis Path">
            <Input value={minisPath} readOnly />
          </Form.Item>
          <Button
            type="link"
            icon={addOptionalOpen ? <UpOutlined /> : <DownOutlined />}
            onClick={() => setAddOptionalOpen((open) => !open)}
            style={{ height: "auto", marginBottom: 18, padding: 0 }}
          >
            {addOptionalOpen ? "收起可选配置" : "展开可选配置（Title、图片）"}
          </Button>
          {addOptionalOpen ? (
            <>
              <Form.Item name="title" label="Title">
                <Input placeholder="不填则使用 Minis 默认标题" maxLength={100} />
              </Form.Item>
              <Form.Item
                name="imageUrl"
                label="Image URL"
                rules={[
                  {
                    validator: (_, value?: string) =>
                      !value || /^https:\/\//i.test(value)
                        ? Promise.resolve()
                        : Promise.reject(new Error("请输入有效的 HTTPS 图片地址")),
                  },
                ]}
              >
                <Input placeholder="不填则使用 Minis 默认图片" />
              </Form.Item>
            </>
          ) : null}
          <Form.Item
            name="remark"
            label="备注"
            rules={[{ required: true, whitespace: true, message: "请输入备注" }, { max: 100 }]}
          >
            <Input.TextArea
              placeholder="例如：8 月美国广告投放"
              maxLength={100}
              showCount
              autoSize={{ minRows: 2, maxRows: 5 }}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑 TikTok Minis Link"
        open={editingRow != null}
        width={600}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
        onOk={() => void saveEdit()}
        onCancel={() => setEditingRow(null)}
        destroyOnHidden
      >
        <Form<EditValues> form={editForm} layout="vertical" requiredMark="optional">
          <Descriptions bordered size="small" column={1} style={{ marginBottom: 20 }}>
            <Descriptions.Item label="URL">
              <Typography.Text copyable={{ text: editingRow?.minis_link || "" }}>
                {editingRow?.minis_link || "—"}
              </Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="广告位">
              {editingRow ? adDisplayName(editingRow.ad_config_id) : "—"}
            </Descriptions.Item>
            <Descriptions.Item label="关联剧">
              {editingRow?.movie_id ? movieTitle(editingRow.movie_id) : "—"}
            </Descriptions.Item>
            <Descriptions.Item label="来源">
              {editingRow?.source_id ? sourceDisplayName(editingRow.source_id) : "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Minis Path">
              <Typography.Text copyable={{ text: editingRow?.minis_path || "" }}>
                {editingRow?.minis_path || "—"}
              </Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="Title">{editingRow?.title || "—"}</Descriptions.Item>
            <Descriptions.Item label="Image URL">
              {editingRow?.image_url ? (
                <Typography.Link href={editingRow.image_url} target="_blank" rel="noopener noreferrer">
                  {editingRow.image_url}
                </Typography.Link>
              ) : "—"}
            </Descriptions.Item>
          </Descriptions>
          <Form.Item
            name="remark"
            label="备注"
            rules={[{ required: true, whitespace: true, message: "请输入备注" }, { max: 100 }]}
          >
            <Input.TextArea maxLength={100} showCount autoSize={{ minRows: 2, maxRows: 5 }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
