import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  Button,
  Checkbox,
  Dropdown,
  Form,
  Input,
  Modal,
  Progress,
  Radio,
  Space,
  Spin,
  Typography,
  message,
} from "antd";
import type { MenuProps } from "antd";
import { apiGet, apiPostJson } from "@/api/client";
import type { ApiResult } from "@/api/types";
import {
  baseNameWithoutExt,
  extractEpisodeNumFromFileName,
  publishMovie,
} from "@/lib/dramaPublishApi";
import { uploadDramaAsset } from "@/lib/dramaPublishUpload";
import type { AdminTagAreaRow } from "@/types/adminMovie";
import styles from "./PublishDramaModal.module.css";

type FormValues = {
  sort: string;
  title: string;
  language: string;
  introduction: string;
  audio_track: "zh-Hans" | "en";
};

type EpisodeUploadRow = {
  clientId: number;
  fileName: string;
  videoKey?: string;
  subtitleKey?: string;
  subtitleName?: string;
  vip: 0 | 1;
  status: "uploading" | "done" | "error";
  progress: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onPublished: () => void;
};

function normalizeTagAreaList(raw: unknown): AdminTagAreaRow[] {
  const list: unknown[] = Array.isArray(raw)
    ? raw
    : raw != null && typeof raw === "object" && "data" in raw && Array.isArray((raw as { data: unknown }).data)
      ? (raw as { data: unknown[] }).data
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

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

let episodeClientSeq = 0;

export function PublishDramaModal({ open, onClose, onPublished }: Props) {
  const [form] = Form.useForm<FormValues>();
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [saving, setSaving] = useState(false);
  const [areas, setAreas] = useState<AdminTagAreaRow[]>([]);
  const [tags, setTags] = useState<AdminTagAreaRow[]>([]);
  const [areaSelected, setAreaSelected] = useState<number[]>([]);
  const [tagSelected, setTagSelected] = useState<number[]>([]);
  const [tagSearch, setTagSearch] = useState("");
  const [addOpen, setAddOpen] = useState<"tag" | "area" | null>(null);
  const [addName, setAddName] = useState("");

  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverKey, setCoverKey] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);

  const [episodes, setEpisodes] = useState<EpisodeUploadRow[]>([]);
  const [lockFrom, setLockFrom] = useState("9");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dropActive, setDropActive] = useState(false);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const subBatchInputRef = useRef<HTMLInputElement>(null);
  const subOneInputRef = useRef<HTMLInputElement>(null);
  const pendingSubClientId = useRef<number | null>(null);

  const resetState = useCallback(() => {
    form.resetFields();
    form.setFieldsValue({
      sort: "100",
      language: "en",
      audio_track: "en",
      introduction: "",
      title: "",
    });
    setAreaSelected([]);
    setTagSelected([]);
    setTagSearch("");
    setCoverPreview(null);
    setCoverKey(null);
    setCoverUploading(false);
    setEpisodes([]);
    setLockFrom("9");
    setDragIndex(null);
    setDragOverIndex(null);
    setDropActive(false);
    pendingSubClientId.current = null;
  }, [form]);

  const loadMeta = useCallback(async () => {
    setLoadingMeta(true);
    try {
      const [tagRes, areaRes] = await Promise.all([apiGet<unknown>("admin/tag"), apiGet<unknown>("admin/area")]);
      setTags(tagRes.c === 0 ? normalizeTagAreaList(tagRes.d) : []);
      setAreas(areaRes.c === 0 ? normalizeTagAreaList(areaRes.d) : []);
      if (tagRes.c !== 0) {
        message.error(tagRes.m || "标签加载失败");
      }
      if (areaRes.c !== 0) {
        message.error(areaRes.m || "地区加载失败");
      }
    } catch {
      message.error("网络异常");
    } finally {
      setLoadingMeta(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      resetState();
      return;
    }
    void loadMeta();
  }, [open, loadMeta, resetState]);

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

  const tagNameById = useMemo(() => new Map(tags.map((t) => [t.id, t.name])), [tags]);
  const areaNameById = useMemo(() => new Map(areas.map((a) => [a.id, a.name])), [areas]);

  const uploadEpisodeVideo = useCallback((clientId: number, file: File) => {
    void uploadDramaAsset(file, (progress) => {
      setEpisodes((prev) =>
        prev.map((row) => (row.clientId === clientId ? { ...row, progress, status: "uploading" } : row)),
      );
    })
      .then((key) => {
        setEpisodes((prev) =>
          prev.map((row) =>
            row.clientId === clientId ? { ...row, videoKey: key, progress: 100, status: "done" } : row,
          ),
        );
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "上传失败";
        message.error(msg);
        setEpisodes((prev) =>
          prev.map((row) => (row.clientId === clientId ? { ...row, progress: 0, status: "error" } : row)),
        );
      });
  }, []);

  const appendVideoFiles = useCallback(
    (fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter((f) => /\.(mp4|mov)$/i.test(f.name));
      if (!files.length) {
        message.warning("未选择到 mp4 / mov 视频");
        return;
      }

      const vttMap = new Map(
        Array.from(fileList)
          .filter((f) => /\.vtt$/i.test(f.name))
          .map((f) => [baseNameWithoutExt(f.name), f]),
      );

      type PendingEpisode = { row: EpisodeUploadRow; file: File; subFile?: File };

      const pending: PendingEpisode[] = files.map((file) => {
        const clientId = ++episodeClientSeq;
        const subFile = vttMap.get(baseNameWithoutExt(file.name));
        return {
          file,
          subFile,
          row: {
            clientId,
            fileName: file.name,
            vip: 0,
            status: "uploading" as const,
            progress: 0,
            subtitleName: subFile?.name,
          },
        };
      });

      const allParsable = pending.every((item) => extractEpisodeNumFromFileName(item.file.name) != null);
      const nextPending = allParsable
        ? [...pending].sort(
            (a, b) =>
              (extractEpisodeNumFromFileName(a.file.name) ?? 0) -
              (extractEpisodeNumFromFileName(b.file.name) ?? 0),
          )
        : pending;

      setEpisodes((prev) => [...prev, ...nextPending.map((item) => item.row)]);
      if (allParsable) {
        message.success(`已按文件名集号排序加入 ${nextPending.length} 集`);
      } else {
        message.success(`已加入 ${nextPending.length} 集（部分文件名无数字，按选择顺序追加）`);
      }

      for (const { row, file, subFile } of nextPending) {
        uploadEpisodeVideo(row.clientId, file);
        if (subFile) {
          void uploadDramaAsset(subFile)
            .then((key) => {
              setEpisodes((prev) =>
                prev.map((ep) =>
                  ep.clientId === row.clientId ? { ...ep, subtitleKey: key, subtitleName: subFile.name } : ep,
                ),
              );
            })
            .catch((err: unknown) => {
              message.error(err instanceof Error ? err.message : "字幕上传失败");
            });
        }
      }
    },
    [uploadEpisodeVideo],
  );

  const handleCoverPick = useCallback(async (file: File | undefined) => {
    if (!file) {
      return;
    }
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
      message.warning("封面仅支持 jpg / png / webp");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      message.warning("封面不能超过 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCoverPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);

    setCoverUploading(true);
    try {
      const key = await uploadDramaAsset(file);
      setCoverKey(key);
      message.success("封面上传成功");
    } catch (err: unknown) {
      setCoverPreview(null);
      setCoverKey(null);
      message.error(err instanceof Error ? err.message : "封面上传失败");
    } finally {
      setCoverUploading(false);
    }
  }, []);

  const handleBatchSubs = useCallback(async (fileList: FileList | File[]) => {
    const vtts = Array.from(fileList).filter((f) => /\.vtt$/i.test(f.name));
    if (!vtts.length) {
      message.warning("未选择到 .vtt 字幕文件");
      return;
    }
    let matched = 0;
    for (const file of vtts) {
      const row = episodes.find((ep) => baseNameWithoutExt(ep.fileName) === baseNameWithoutExt(file.name));
      if (!row) {
        continue;
      }
      try {
        const key = await uploadDramaAsset(file);
        setEpisodes((prev) =>
          prev.map((ep) =>
            ep.clientId === row.clientId ? { ...ep, subtitleKey: key, subtitleName: file.name } : ep,
          ),
        );
        matched += 1;
      } catch (err: unknown) {
        message.error(err instanceof Error ? err.message : "字幕上传失败");
      }
    }
    if (matched === 0) {
      message.warning("没有匹配到同名分集");
    } else {
      message.success(`字幕匹配成功 ${matched} 集`);
    }
  }, [episodes]);

  const handleSingleSub = useCallback(async (file: File | undefined) => {
    const clientId = pendingSubClientId.current;
    pendingSubClientId.current = null;
    if (!file || clientId == null) {
      return;
    }
    if (!/\.vtt$/i.test(file.name)) {
      message.warning("仅支持 .vtt 格式");
      return;
    }
    try {
      const key = await uploadDramaAsset(file);
      setEpisodes((prev) =>
        prev.map((ep) =>
          ep.clientId === clientId ? { ...ep, subtitleKey: key, subtitleName: file.name } : ep,
        ),
      );
      message.success("字幕已更新");
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "字幕上传失败");
    }
  }, []);

  const toggleArea = (id: number) => {
    setAreaSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleTag = (id: number) => {
    setTagSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSaveAdd = async () => {
    const value = addName.trim();
    if (!/^[a-zA-Z0-9_\-]{1,24}$/.test(value)) {
      message.warning("仅允许 1–24 位字母、数字、下划线或连字符");
      return;
    }
    if (addOpen === "area") {
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

  const tryClose = () => {
    const title = form.getFieldValue("title")?.trim();
    if (title || coverKey || episodes.length) {
      Modal.confirm({
        title: "确认关闭？",
        content: "当前内容未保存，关闭后将丢失。",
        okText: "关闭",
        cancelText: "继续编辑",
        onOk: onClose,
      });
      return;
    }
    onClose();
  };

  const handlePublish = async (mode: "draft" | "publish") => {
    try {
      const v = await form.validateFields();
      if (!coverKey) {
        message.warning("请上传封面");
        return;
      }
      if (mode === "publish" && episodes.length === 0) {
        message.warning("上架前请至少添加 1 集");
        return;
      }
      if (episodes.some((ep) => ep.status === "uploading")) {
        message.warning("分集仍在上传中，请稍候");
        return;
      }
      if (episodes.some((ep) => ep.status === "error")) {
        message.warning("存在上传失败的分集，请删除后重试");
        return;
      }
      if (episodes.some((ep) => ep.status === "done" && !ep.videoKey)) {
        message.warning("存在未上传成功的分集");
        return;
      }

      const sortNum = Number(v.sort);
      if (!Number.isFinite(sortNum)) {
        message.warning("排序必须是数字");
        return;
      }

      setSaving(true);
      const res = await publishMovie({
        title: v.title.trim(),
        language: v.language.trim() || "en",
        introduction: v.introduction?.trim() ?? "",
        cover_key: coverKey,
        audio_track: v.audio_track,
        sort: sortNum,
        status: mode === "publish" ? 1 : 2,
        tags: tagSelected.map((id) => tagNameById.get(id)).filter((name): name is string => Boolean(name)),
        area: areaSelected.map((id) => areaNameById.get(id)).filter((name): name is string => Boolean(name)),
        episodes: episodes
          .filter((ep) => ep.status === "done" && ep.videoKey)
          .map((ep, index) => ({
            ep: index + 1,
            video_key: ep.videoKey!,
            ...(ep.subtitleKey ? { subtitle_key: ep.subtitleKey } : {}),
            vip: ep.vip,
          })),
      });

      if (res.c !== 0) {
        message.error(res.m || "保存失败");
        return;
      }
      message.success(mode === "draft" ? "已存为草稿" : "已保存并上架");
      onPublished();
      onClose();
    } catch {
      /* validate */
    } finally {
      setSaving(false);
    }
  };

  const applyBatchLock = () => {
    const n = Number(lockFrom);
    if (!Number.isFinite(n) || n < 1) {
      message.warning("请输入合法集数");
      return;
    }
    setEpisodes((prev) => prev.map((ep, index) => ({ ...ep, vip: index + 1 >= n ? 1 : 0 })));
    message.success(`已设置：第 ${n} 集起锁定`);
  };

  const clearEpisodes = () => {
    Modal.confirm({
      title: "清空全部分集？",
      okText: "清空",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: () => setEpisodes([]),
    });
  };

  const removeEpisode = (clientId: number) => {
    setEpisodes((prev) => prev.filter((ep) => ep.clientId !== clientId));
  };

  const toggleEpisodeVip = (clientId: number) => {
    setEpisodes((prev) =>
      prev.map((ep) => (ep.clientId === clientId ? { ...ep, vip: ep.vip ? 0 : 1 } : ep)),
    );
  };

  const removeEpisodeSub = (clientId: number) => {
    setEpisodes((prev) =>
      prev.map((ep) =>
        ep.clientId === clientId ? { ...ep, subtitleKey: undefined, subtitleName: undefined } : ep,
      ),
    );
    message.success("字幕已删除");
  };

  const onDropReorder = (toIndex: number) => {
    if (dragIndex == null || dragIndex === toIndex) {
      setDragOverIndex(null);
      return;
    }
    setEpisodes((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      if (!moved) {
        return prev;
      }
      next.splice(toIndex, 0, moved);
      return next;
    });
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const subtitleMenu = (row: EpisodeUploadRow): MenuProps => ({
    items: [
      {
        key: "replace",
        label: "更换字幕",
        onClick: () => {
          pendingSubClientId.current = row.clientId;
          subOneInputRef.current?.click();
        },
      },
      {
        key: "remove",
        label: "删除字幕",
        danger: true,
        onClick: () => removeEpisodeSub(row.clientId),
      },
    ],
  });

  const uploadingCount = episodes.filter((ep) => ep.status === "uploading").length;
  const doneCount = episodes.filter((ep) => ep.status === "done").length;
  const subCount = episodes.filter((ep) => ep.subtitleKey).length;

  return (
    <>
      <Modal
        title="新增短剧"
        open={open}
        onCancel={tryClose}
        width={640}
        destroyOnHidden
        maskClosable={!saving}
        footer={
          <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
            <span className={styles.footerHint}>
              {uploadingCount > 0 ? "分集上传中，请等待完成后再保存…" : null}
            </span>
            <Space className={styles.footerActions}>
              <Button onClick={tryClose} disabled={saving}>
                取消
              </Button>
              <Button loading={saving} onClick={() => void handlePublish("draft")}>
                存为草稿
              </Button>
              <Button type="primary" loading={saving} onClick={() => void handlePublish("publish")}>
                保存并上架
              </Button>
            </Space>
          </div>
        }
      >
        <Spin spinning={loadingMeta || coverUploading}>
          <div className={styles.modalBody}>
            <table className={styles.infoTable}>
              <tbody>
                <tr>
                  <td className={styles.infoLabel}>状态</td>
                  <td>草稿（保存后可上架）</td>
                  <td className={`${styles.infoLabel} ${styles.infoSplit}`}>短剧 ID</td>
                  <td className={styles.placeholder}>保存后生成</td>
                </tr>
                <tr>
                  <td className={styles.infoLabel}>创建时间</td>
                  <td className={styles.placeholder}>—</td>
                  <td className={`${styles.infoLabel} ${styles.infoSplit}`}>更新时间</td>
                  <td className={styles.placeholder}>—</td>
                </tr>
              </tbody>
            </table>

            <div style={{ marginTop: 16 }}>
              <Typography.Text type="secondary">封面（必传，建议 9:16，jpg/png ≤ 2MB）</Typography.Text>
              <div className={styles.coverRow}>
                <div
                  className={`${styles.coverBox} ${coverPreview ? styles.coverBoxFilled : ""}`}
                  onClick={() => {
                    if (coverPreview) {
                      Modal.info({
                        title: "封面预览",
                        icon: null,
                        content: <img src={coverPreview} alt="" style={{ width: "100%", borderRadius: 6 }} />,
                        width: 360,
                      });
                      return;
                    }
                    coverInputRef.current?.click();
                  }}
                  title={coverPreview ? "点击查看大图" : "点击选择封面"}
                >
                  {coverPreview ? (
                    <img src={coverPreview} alt="" className={styles.coverImg} />
                  ) : (
                    <span className={styles.coverPlus}>+</span>
                  )}
                </div>
                {coverPreview ? (
                  <Button type="link" className={styles.coverReplace} onClick={() => coverInputRef.current?.click()}>
                    更换
                  </Button>
                ) : null}
              </div>
            </div>

            <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
              <Form.Item name="sort" label="排序" rules={[{ required: true, message: "请填写排序" }]}>
                <Input placeholder="数字，推荐位一般为 100" />
              </Form.Item>
              <Form.Item name="title" label="短剧名称" rules={[{ required: true, message: "请填写短剧名称" }]}>
                <Input placeholder="输入短剧名称" />
              </Form.Item>
              <Form.Item name="language" label="语言" initialValue="en">
                <Input placeholder="如 en、zh" />
              </Form.Item>
              <Form.Item name="introduction" label="简介">
                <Input.TextArea rows={3} placeholder="短剧简介" />
              </Form.Item>
              <Form.Item
                name="audio_track"
                label="音轨"
                rules={[{ required: true, message: "请选择音轨" }]}
                initialValue="en"
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
            </div>

            <div style={{ marginTop: 16 }}>
              <Typography.Text type="secondary">标签（已选 {tagSelected.length}）</Typography.Text>
              <div className={styles.tagSearchRow}>
                <Input allowClear placeholder="筛选标签名称" value={tagSearch} onChange={(e) => setTagSearch(e.target.value)} />
              </div>
              <div className={styles.tagAreaWrap}>
                {filteredTags.map((t) => (
                  <label key={t.id} className={styles.checkCard}>
                    <Checkbox checked={tagSelected.includes(t.id)} onChange={() => toggleTag(t.id)} />
                    <span>{t.name}</span>
                  </label>
                ))}
                <button type="button" className={styles.addChip} onClick={() => { setAddOpen("tag"); setAddName(""); }}>
                  + 添加标签
                </button>
              </div>
            </div>

            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #f0f0f0" }}>
              <div className={styles.episodeHead}>
                <Typography.Text>分集 <Typography.Text type="secondary">（拖拽行可排序）</Typography.Text></Typography.Text>
                <span className={styles.episodeSummary}>
                  共 {episodes.length} 集 · 有视频 {doneCount} · 有字幕 {subCount}
                </span>
              </div>

              <div
                className={`${styles.dropZone} ${dropActive ? styles.dropZoneActive : ""}`}
                onClick={() => videoInputRef.current?.click()}
                onDragOver={(e: DragEvent) => {
                  e.preventDefault();
                  setDropActive(true);
                }}
                onDragLeave={() => setDropActive(false)}
                onDrop={(e: DragEvent) => {
                  e.preventDefault();
                  setDropActive(false);
                  if (e.dataTransfer.files?.length) {
                    appendVideoFiles(e.dataTransfer.files);
                  }
                }}
              >
                <div className={styles.dropZoneText}>
                  点击或拖拽视频到此处，<Typography.Text strong>支持多选批量上传</Typography.Text>
                </div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  支持 mp4 / mov；同批可附带 .vtt 字幕（按文件名同名匹配）
                </Typography.Text>
              </div>

              {episodes.length > 0 ? (
                <div className={styles.epToolbar}>
                  <Button type="link" size="small" onClick={() => subBatchInputRef.current?.click()}>
                    批量上传字幕
                  </Button>
                  <span className={styles.epToolbarSep}>|</span>
                  <span>
                    从第
                    <Input
                      size="small"
                      className={styles.lockFromInput}
                      value={lockFrom}
                      onChange={(e) => setLockFrom(e.target.value)}
                    />
                    集起锁定
                  </span>
                  <Button type="link" size="small" onClick={applyBatchLock}>
                    应用
                  </Button>
                  <span className={styles.epToolbarSep}>|</span>
                  <Button type="link" size="small" danger onClick={clearEpisodes}>
                    清空全部
                  </Button>
                </div>
              ) : null}

              <div className={styles.episodeGrid}>
                {episodes.map((row, index) => (
                  <div
                    key={row.clientId}
                    className={`${styles.epRow} ${dragIndex === index ? styles.epRowDragging : ""} ${dragOverIndex === index ? styles.epRowDragOver : ""}`}
                    draggable={row.status !== "uploading"}
                    onDragStart={() => setDragIndex(index)}
                    onDragEnd={() => {
                      setDragIndex(null);
                      setDragOverIndex(null);
                    }}
                    onDragOver={(e: DragEvent) => {
                      e.preventDefault();
                      setDragOverIndex(index);
                    }}
                    onDragLeave={() => setDragOverIndex(null)}
                    onDrop={(e: DragEvent) => {
                      e.preventDefault();
                      onDropReorder(index);
                    }}
                  >
                    <span className={styles.epDragHandle} title="拖拽排序">
                      ⠿
                    </span>
                    <span className={styles.epNum}>{String(index + 1).padStart(3, "0")}</span>
                    <span className={styles.epName} title={row.fileName}>
                      {row.fileName}
                    </span>
                    {row.status === "uploading" ? (
                      <Progress percent={row.progress} size="small" className={styles.epProgress} showInfo={false} />
                    ) : row.status === "error" ? (
                      <span className={styles.epError}>失败</span>
                    ) : (
                      <>
                        <span className={styles.epIconOk}>▶</span>
                        {row.subtitleKey ? (
                          <Dropdown menu={subtitleMenu(row)} trigger={["click"]}>
                            <button
                              type="button"
                              className={`${styles.epIconSub} ${styles.epIconSubOn}`}
                              title={row.subtitleName ? `字幕：${row.subtitleName}` : "已有字幕"}
                            >
                              字
                            </button>
                          </Dropdown>
                        ) : (
                          <button
                            type="button"
                            className={`${styles.epIconSub} ${styles.epIconSubOff}`}
                            title="无字幕，点击上传 .vtt"
                            onClick={() => {
                              pendingSubClientId.current = row.clientId;
                              subOneInputRef.current?.click();
                            }}
                          >
                            字
                          </button>
                        )}
                        <button
                          type="button"
                          className={`${styles.epIconLock} ${row.vip ? styles.epIconLockOn : styles.epIconLockOff}`}
                          onClick={() => toggleEpisodeVip(row.clientId)}
                        >
                          {row.vip ? "锁" : "开"}
                        </button>
                      </>
                    )}
                    <button type="button" className={styles.epRemove} onClick={() => removeEpisode(row.clientId)}>
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Spin>
      </Modal>

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
          名称规则：1–24 位，仅字母、数字、下划线、连字符。
        </Typography.Paragraph>
        <Input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="英文标识，如 romance" maxLength={24} />
      </Modal>

      <input
        ref={coverInputRef}
        className={styles.hiddenInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => {
          void handleCoverPick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={videoInputRef}
        className={styles.hiddenInput}
        type="file"
        multiple
        accept=".mp4,.mov,.vtt,video/mp4,video/quicktime,text/vtt"
        onChange={(e) => {
          if (e.target.files?.length) {
            appendVideoFiles(e.target.files);
          }
          e.target.value = "";
        }}
      />
      <input
        ref={subBatchInputRef}
        className={styles.hiddenInput}
        type="file"
        multiple
        accept=".vtt,text/vtt"
        onChange={(e) => {
          if (e.target.files?.length) {
            void handleBatchSubs(e.target.files);
          }
          e.target.value = "";
        }}
      />
      <input
        ref={subOneInputRef}
        className={styles.hiddenInput}
        type="file"
        accept=".vtt,text/vtt"
        onChange={(e) => {
          void handleSingleSub(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </>
  );
}
