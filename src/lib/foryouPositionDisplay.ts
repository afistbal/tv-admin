import type { ForyouPositionSrc } from "@/types/adminForyou";

export const FORYOU_SRC_OPTIONS: { value: ForyouPositionSrc; label: string }[] = [
  { value: "recommend", label: "推荐池" },
  { value: "n", label: "N 级" },
  { value: "a", label: "A 级" },
  { value: "b", label: "B 级" },
];

export const DEFAULT_FORYOU_POSITION_DESC: Record<number, string> = {
  1: "",
  2: "核心爆款N级短剧自动展位",
  3: "优质A级好剧精准推荐展位",
  4: "常规B级短剧日常推广位",
  5: "推荐池精选好剧，高转化率拉新专区",
  6: "重磅热推N级短剧焦点卡位",
  7: "",
  8: "",
  9: "",
  10: "",
};

export function foryouSrcLabel(src: ForyouPositionSrc): string {
  return FORYOU_SRC_OPTIONS.find((o) => o.value === src)?.label ?? src;
}
