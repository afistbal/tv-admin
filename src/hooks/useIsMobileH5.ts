import { useEffect, useState } from "react";

/** 与 antd `lg` 断点一致：横屏手机宽度通常 800~950px */
const H5_LANDSCAPE_MAX_WIDTH = 992;

export type MobileH5State = {
  isMobile: boolean;
  isLandscapePhone: boolean;
};

function readViewport(): { width: number; height: number } {
  const vv = window.visualViewport;
  return {
    width: Math.round(vv?.width ?? window.innerWidth),
    height: Math.round(vv?.height ?? window.innerHeight),
  };
}

/**
 * H5 判定：
 * - 竖屏：宽度 < 768
 * - 横屏：宽度 > 高度 且 宽度 < 992（否则会被当成 PC，继续渲染左侧 Sider）
 */
export function readMobileH5State(): MobileH5State {
  if (typeof window === "undefined") {
    return { isMobile: false, isLandscapePhone: false };
  }

  const { width, height } = readViewport();
  const narrow = width < 768;
  const isLandscapePhone = width > height && width < H5_LANDSCAPE_MAX_WIDTH;

  return {
    isMobile: narrow || isLandscapePhone,
    isLandscapePhone,
  };
}

export function useMobileH5State(): MobileH5State {
  const [state, setState] = useState<MobileH5State>(readMobileH5State);

  useEffect(() => {
    const update = () => setState(readMobileH5State());
    const updateDelayed = () => {
      update();
      window.setTimeout(update, 100);
      window.setTimeout(update, 320);
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", updateDelayed);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", updateDelayed);
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
    };
  }, []);

  return state;
}

export function useIsMobileH5(): boolean {
  return useMobileH5State().isMobile;
}
