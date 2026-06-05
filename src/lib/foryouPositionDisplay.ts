import type { ForyouPositionSrc } from "@/types/adminForyou";

export const FORYOU_SRC_OPTIONS: { value: ForyouPositionSrc; label: string }[] = [
  { value: "recommend", label: "推荐池" },
  { value: "n", label: "≤ 3 天" },
  { value: "a", label: "4-30 天" },
  { value: "b", label: "> 30 天" },
];

export const DEFAULT_FORYOU_POSITION_DESC: Record<number, string> = {
  1: "",
  2: "核心爆款≤3天短剧自动展位",
  3: "上架4-30天好剧精准推荐展位",
  4: "上架>30天短剧日常推广位",
  5: "推荐池精选好剧，高转化率拉新专区",
  6: "重磅热推≤3天短剧焦点卡位",
  7: "",
  8: "",
  9: "",
  10: "",
};

export function foryouSrcLabel(src: ForyouPositionSrc): string {
  return FORYOU_SRC_OPTIONS.find((o) => o.value === src)?.label ?? src;
}
