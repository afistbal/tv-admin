import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Checkbox,
  Descriptions,
  Drawer,
  Form,
  Image,
  Input,
  Modal,
  Radio,
  Space,
  Spin,
  Typography,
  message,
} from "antd";
import { DownOutlined, UpOutlined } from "@ant-design/icons";
import { apiGet, apiPostJson } from "@/api/client";
import type { ApiResult } from "@/api/types";
import type {
  AdminMovieDetailPayload,
  AdminMovieEpisodeRow,
  AdminTagAreaRow,
} from "@/types/adminMovie";
import { moviePosterUrl } from "@/lib/staticAssetOrigin";
import { formatDateTimeZh } from "@/lib/formatDateTime";
import styles from "./MovieEditModal.module.css";

type FormValues = {
  sort: string;
  title: string;
  audio_track: string;
};

export type EpisodeEditState = {
  id: number;
  episode: number;
  video?: string;
  vip: number;
  subtitle?: { id?: number; url?: string } | null;
};

function movieStatusLabel(status: unknown): string {
  const s = Number(status);
  if (s === 1) {
    return "上架";
  }
  if (s === 2) {
    return "下架";
  }
  if (s === 3) {
    return "已删除";
  }
  return "—";
}

/** 兼容 `d` 为数组或 `{ data: [] }` 等包装 */
function normalizeTagAreaList(raw: unknown): AdminTagAreaRow[] {
  const list: unknown[] = Array.isArray(raw)
    ? raw
    : raw != null && typeof raw === "object" && "data" in raw && Array.isArray((raw as { data: unknown }).data)
      ? (raw as { data: unknown[] }).data
      : raw != null && typeof raw === "object" && "list" in raw && Array.isArray((raw as { list: unknown }).list)
        ? (raw as { list: unknown[] }).list
        : [];
  const out: AdminTagAreaRow[] = [];
  for (const row of list) {
    if (row == null || typeof row !== "object") {
      continue;
    }
    const o = row as Record<string, unknown>;
    const id = Number(o.id ?? o.ID);
    const name = String(o.name ?? o.title ?? o.label ?? "").trim();
    if (Number.isFinite(id) && name) {
      out.push({ id, name });
    }
  }
  return out;
}

function normalizeIdArray(raw: unknown): number[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const ids: number[] = [];
  for (const x of raw) {
    if (typeof x === "number" && Number.isFinite(x)) {
      ids.push(x);
    } else if (x != null && typeof x === "object" && "id" in x) {
      const n = Number((x as { id: unknown }).id);
      if (Number.isFinite(n)) {
        ids.push(n);
      }
    } else if (typeof x === "string" && x.trim() !== "") {
      const n = Number(x);
      if (Number.isFinite(n)) {
        ids.push(n);
      }
    }
  }
  return ids;
}

function parseEpisodesFromDetail(d: AdminMovieDetailPayload): EpisodeEditState[] {
  const raw = Array.isArray(d.episodes) ? d.episodes : [];
  return raw.map((v: AdminMovieEpisodeRow, idx: number) => {
    const st = v.subtitle as { id?: number; url?: string } | null | undefined;
    return {
      id: Number(v.id ?? 0),
      episode: Number(v.episode ?? idx + 1),
      video: v.video != null ? String(v.video) : undefined,
      vip: Number(v.vip) > 0 ? 1 : 0,
      subtitle:
        st && (st.url || st.id)
          ? { id: st.id, url: st.url != null ? String(st.url) : undefined }
          : null,
    };
  });
}

function mediaUrl(path: string | null | undefined, staticBase: string | null): string | null {
  return moviePosterUrl(path ?? undefined, staticBase);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 仅在父级 `editId != null` 时挂载（带 `key={movieId}`），避免 Modal 销毁子树导致 `useForm` 未连接。
 */
export function MovieEditModal(props: {
  movieId: number;
  staticBase: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { movieId, staticBase, onClose, onSaved } = props;
  const [form] = Form.useForm<FormValues>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<AdminMovieDetailPayload | null>(null);
  const [areas, setAreas] = useState<AdminTagAreaRow[]>([]);
  const [tags, setTags] = useState<AdminTagAreaRow[]>([]);
  const [areaSelected, setAreaSelected] = useState<number[]>([]);
  const [tagSelected, setTagSelected] = useState<number[]>([]);
  const [tagSearch, setTagSearch] = useState("");
  const [hideTag, setHideTag] = useState(true);
  const [episodes, setEpisodes] = useState<EpisodeEditState[]>([]);
  const episodeVipInitial = useRef<Record<number, number>>({});
  const [episodeDrawerIdx, setEpisodeDrawerIdx] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState<"tag" | "area" | null>(null);
  const [addName, setAddName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setDetail(null);
    setTagSearch("");
    setHideTag(true);
    setEpisodeDrawerIdx(null);
    setAddOpen(null);
    try {
      const [movieRes, tagRes, areaRes] = await Promise.all([
        apiGet<AdminMovieDetailPayload>("admin/movie", { id: movieId }),
        apiGet<unknown>("admin/tag"),
        apiGet<unknown>("admin/area"),
      ]);
      const tagList = tagRes.c === 0 ? normalizeTagAreaList(tagRes.d) : [];
      const areaList = areaRes.c === 0 ? normalizeTagAreaList(areaRes.d) : [];
      if (tagRes.c !== 0) {
        message.error(tagRes.m || "标签加载失败");
      }
      if (areaRes.c !== 0) {
        message.error(areaRes.m || "地区加载失败");
      }
      setTags(tagList);
      setAreas(areaList);

      if (movieRes.c !== 0) {
        const msg = movieRes.m || "加载影片失败";
        message.error(msg);
        setLoadError(msg);
        return;
      }
      const d = movieRes.d;
      setDetail(d);
      const info = d.info;
      const sortVal = info["sort"];
      const titleVal = info["title"];
      const track = info["audio_track"];
      form.setFieldsValue({
        sort: sortVal != null && sortVal !== "" ? String(sortVal) : "",
        title: String(titleVal ?? ""),
        audio_track:
          track == null || track === "" ? "zh-Hans" : String(track) === "en" ? "en" : "zh-Hans",
      });
      setAreaSelected(normalizeIdArray(d.area));
      setTagSelected(normalizeIdArray(d.tag));
      const eps = parseEpisodesFromDetail(d);
      setEpisodes(eps);
      const vipMap: Record<number, number> = {};
      for (const e of eps) {
        if (e.id) {
          vipMap[e.id] = e.vip;
        }
      }
      episodeVipInitial.current = vipMap;
    } catch {
      message.error("网络异常");
      setLoadError("网络异常");
    } finally {
      setLoading(false);
    }
  }, [movieId, form]);

  useEffect(() => {
    void load();
  }, [load]);

  const imageName = detail?.info["image"] != null ? String(detail.info["image"]) : "";
  const poster = moviePosterUrl(imageName || undefined, staticBase);

  const filteredTags = useMemo(() => {
    const q = tagSearch.trim();
    if (!q) {
      return tags;
    }
    try {
      const re = new RegExp(escapeRegExp(q), "i");
      return tags.filter((t) => re.test(t.name));
    } catch {
      return tags;
    }
  }, [tags, tagSearch]);

  const toggleArea = (id: number) => {
    setAreaSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleTag = (id: number) => {
    setTagSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const openStaticUrl = (path: string | undefined) => {
    const url = mediaUrl(path, staticBase);
    if (!url) {
      message.warning("未配置静态资源域名（config.static 或 VITE_STATIC_ASSET_ORIGIN）");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const currentEpisode = episodeDrawerIdx != null ? episodes[episodeDrawerIdx] : null;

  const toggleEpisodeVip = () => {
    if (episodeDrawerIdx == null) {
      return;
    }
    setEpisodes((prev) => {
      const next = [...prev];
      const ep = next[episodeDrawerIdx];
      if (!ep) {
        return prev;
      }
      next[episodeDrawerIdx] = { ...ep, vip: ep.vip > 0 ? 0 : 1 };
      return next;
    });
  };

  const handleSaveAdd = async () => {
    const value = addName.trim();
    if (!/^[a-zA-Z0-9_\-]{1,24}$/.test(value)) {
      message.warning("仅允许 1–24 位字母、数字、下划线或连字符");
      return;
    }
    if (addOpen === "area") {
      if (areas.some((a) => a.name === value)) {
        message.info("该地区已存在");
        setAddOpen(null);
        setAddName("");
        return;
      }
      const res: ApiResult<number> = await apiPostJson("admin/area", { name: value });
      if (res.c !== 0) {
        message.error(res.m || "创建失败");
        return;
      }
      const newId = Number(res.d);
      if (Number.isFinite(newId)) {
        setAreas((a) => [...a, { id: newId, name: value }]);
      }
    } else if (addOpen === "tag") {
      if (tags.some((t) => t.name === value)) {
        message.info("该标签已存在");
        setAddOpen(null);
        setAddName("");
        return;
      }
      const res: ApiResult<number> = await apiPostJson("admin/tag", { name: value });
      if (res.c !== 0) {
        message.error(res.m || "创建失败");
        return;
      }
      const newId = Number(res.d);
      if (Number.isFinite(newId)) {
        setTags((t) => [...t, { id: newId, name: value }]);
      }
    }
    message.success("已添加");
    setAddOpen(null);
    setAddName("");
  };

  const handleOk = async () => {
    try {
      const v = await form.validateFields();
      const changedEpisodes = episodes
        .filter((ep) => episodeVipInitial.current[ep.id] !== undefined && episodeVipInitial.current[ep.id] !== ep.vip)
        .map((ep) => ({ id: ep.id, vip: ep.vip }));
      setSaving(true);
      const res: ApiResult<unknown> = await apiPostJson("admin/movie/save", {
        id: movieId,
        title: v.title,
        sort: v.sort,
        audio_track: v.audio_track,
        area: areaSelected,
        tag: tagSelected,
        episodes: changedEpisodes,
      });
      if (res.c !== 0) {
        message.error(res.m || "保存失败");
        return;
      }
      message.success("已保存");
      for (const ep of episodes) {
        episodeVipInitial.current[ep.id] = ep.vip;
      }
      onSaved();
      onClose();
    } catch {
      /* validate */
    } finally {
      setSaving(false);
    }
  };

  const info = detail?.info;

  return (
    <Modal
      title={`编辑短剧 #${movieId}`}
      open
      onCancel={onClose}
      onOk={() => void handleOk()}
      confirmLoading={saving}
      width={760}
      destroyOnHidden
      okText="保存"
      cancelText="取消"
      styles={{ body: { maxHeight: "72vh", overflowY: "auto" } }}
    >
      <Spin spinning={loading}>
        <div className={styles.spinNest}>
          {loadError ? (
            <Typography.Text type="danger">{loadError}</Typography.Text>
          ) : !detail ? (
            <Typography.Text type="secondary">加载中…</Typography.Text>
          ) : (
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
              <Descriptions size="small" column={2} bordered>
                <Descriptions.Item label="状态">{movieStatusLabel(info?.["status"])}</Descriptions.Item>
                <Descriptions.Item label="短剧 ID">{String(info?.["id"] ?? movieId)}</Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {formatDateTimeZh(info?.["created_at"] as string | undefined)}
                </Descriptions.Item>
                <Descriptions.Item label="更新时间">
                  {formatDateTimeZh(info?.["updated_at"] as string | undefined)}
                </Descriptions.Item>
              </Descriptions>

              <div>
                <Typography.Text type="secondary">封面（只读预览）</Typography.Text>
                <div className={styles.coverRow}>
                  {poster ? (
                    <Image src={poster} alt="" width={96} height={128} className={styles.coverImg} preview />
                  ) : (
                    <span className={styles.coverPlaceholder}>无</span>
                  )}
                </div>
              </div>

              <Form form={form} layout="vertical">
                <Form.Item name="sort" label="排序" rules={[{ required: true, message: "请填写排序" }]}>
                  <Input placeholder="数字，推荐位一般为 100" />
                </Form.Item>
                <Form.Item name="title" label="短剧名称" rules={[{ required: true, message: "请填写名称" }]}>
                  <Input placeholder="标题" />
                </Form.Item>
                <Form.Item
                  name="audio_track"
                  label="音轨"
                  tooltip="剧集默认对白语言：zh-Hans 或 en，与 slot 后台一致"
                  rules={[{ required: true, message: "请选择音轨" }]}
                >
                  <Radio.Group>
                    <Radio value="zh-Hans">zh-Hans</Radio>
                    <Radio value="en">en</Radio>
                  </Radio.Group>
                </Form.Item>
              </Form>

              <div>
                <Typography.Text type="secondary">地区（已选 {areaSelected.length}）</Typography.Text>
                <div className={styles.tagAreaWrap}>
                  {areas.map((a) => (
                    <label key={a.id} className={styles.checkCard}>
                      <Checkbox checked={areaSelected.includes(a.id)} onChange={() => toggleArea(a.id)} />
                      <span>{a.name}</span>
                    </label>
                  ))}
                  <button type="button" className={styles.addChip} onClick={() => { setAddOpen("area"); setAddName(""); }}>
                    + 添加地区
                  </button>
                </div>
                {areas.length === 0 ? (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    接口未返回地区数据；若后端路径不同或需权限，请检查 GET admin/area 的响应结构。
                  </Typography.Text>
                ) : null}
              </div>

              <div>
                <Typography.Text type="secondary">标签（已选 {tagSelected.length}）</Typography.Text>
                <div className={styles.tagSearchRow}>
                  <Input
                    allowClear
                    placeholder="筛选标签名称"
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                  />
                  <Button
                    type="default"
                    icon={hideTag ? <DownOutlined /> : <UpOutlined />}
                    onClick={() => setHideTag((v) => !v)}
                    title={hideTag ? "展开全部" : "收起（仅多显时折叠）"}
                  />
                </div>
                <div className={styles.tagAreaWrap}>
                  {filteredTags.map((t, k) => (
                    <label
                      key={t.id}
                      className={styles.checkCard}
                      style={hideTag && k > 10 ? { display: "none" } : undefined}
                    >
                      <Checkbox checked={tagSelected.includes(t.id)} onChange={() => toggleTag(t.id)} />
                      <span>{t.name}</span>
                    </label>
                  ))}
                  <button type="button" className={`${styles.addChip} ${styles.addChipTag}`} onClick={() => { setAddOpen("tag"); setAddName(""); }}>
                    + 添加标签
                  </button>
                </div>
              </div>

              <div>
                <Typography.Text type="secondary">分集（点击一行打开操作）</Typography.Text>
                <div className={styles.episodeSummary}>
                  共 {episodes.length} 集 · 有视频{" "}
                  {episodes.filter((e) => e.video).length} · 有字幕{" "}
                  {episodes.filter((e) => e.subtitle?.url).length}
                </div>
                <div className={styles.episodeGrid}>
                  {episodes.map((ep, idx) => (
                    <button
                      key={ep.id || idx}
                      type="button"
                      className={styles.episodeCard}
                      onClick={() => setEpisodeDrawerIdx(idx)}
                    >
                      <span className={styles.epNum}>{String(ep.episode).padStart(3, "0")}</span>
                      <span className={styles.epIcons}>
                        {ep.video ? <span className={styles.icOk}>▶</span> : <span className={styles.icBad}>—</span>}
                        {ep.subtitle?.url ? <span className={styles.icOk}>字</span> : <span className={styles.icBad}>字</span>}
                        {ep.vip > 0 ? <span className={styles.icLock}>锁</span> : <span className={styles.icOpen}>开</span>}
                      </span>
                    </button>
                  ))}
                </div>
                {episodes.length === 0 ? <Typography.Text type="secondary">暂无分集</Typography.Text> : null}
              </div>
            </Space>
          )}
        </div>
      </Spin>

      <Drawer
        title={currentEpisode ? `第 ${currentEpisode.episode} 集` : "分集"}
        placement="right"
        width={360}
        open={episodeDrawerIdx != null}
        onClose={() => setEpisodeDrawerIdx(null)}
        destroyOnHidden
      >
        {currentEpisode ? (
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <Button block type="primary" danger onClick={() => openStaticUrl(currentEpisode.video)}>
              1. 播放视频
            </Button>
            <Button block type="primary" style={{ background: "#389e0d" }} onClick={() => openStaticUrl(currentEpisode.subtitle?.url)}>
              2. 查看字幕
            </Button>
            <Button block onClick={toggleEpisodeVip}>
              3. {currentEpisode.vip > 0 ? "解锁（VIP 关）" : "锁定（VIP 开）"}
            </Button>
            <Button block onClick={() => setEpisodeDrawerIdx(null)}>
              取消
            </Button>
          </Space>
        ) : null}
      </Drawer>

      <Modal
        title={addOpen === "area" ? "添加地区" : addOpen === "tag" ? "添加标签" : ""}
        open={addOpen != null}
        onCancel={() => { setAddOpen(null); setAddName(""); }}
        onOk={() => void handleSaveAdd()}
        okText="确定"
        cancelText="取消"
        destroyOnHidden
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 8, fontSize: 13 }}>
          名称规则：1–24 位，仅字母、数字、下划线、连字符（与 slot 后台一致）。
        </Typography.Paragraph>
        <Input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="英文标识，如 romance" maxLength={24} />
      </Modal>
    </Modal>
  );
}
