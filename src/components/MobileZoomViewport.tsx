import type { CSSProperties, ReactNode } from "react";
import styles from "./MobileZoomViewport.module.css";

type MobileZoomViewportProps = {
  zoom: number;
  children: ReactNode;
};

/**
 * H5 页面缩放：使用 CSS `zoom` 而非 `transform: scale`，
 * 避免缩放后滚动区域仍按原尺寸计算导致右/下大面积留白。
 */
export function MobileZoomViewport({ zoom, children }: MobileZoomViewportProps) {
  const zoomStyle: CSSProperties | undefined =
    zoom !== 1 ? ({ zoom } as CSSProperties) : undefined;

  return (
    <div className={styles.viewport}>
      <div className={styles.content} style={zoomStyle}>
        {children}
      </div>
    </div>
  );
}
