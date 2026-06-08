import type { MouseEvent, TouchEvent } from "react";
import { PAGE_ZOOM_DEFAULT } from "@/hooks/usePageZoom";
import styles from "./MobilePageZoom.module.css";

type MobilePageZoomProps = {
  zoom: number;
  canDecrease: boolean;
  canIncrease: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
  onReset: () => void;
  theme?: "light" | "dark";
};

export function MobilePageZoom(props: MobilePageZoomProps) {
  const { zoom, canDecrease, canIncrease, onDecrease, onIncrease, onReset, theme = "light" } = props;
  const showReset = zoom !== PAGE_ZOOM_DEFAULT;

  const stopMenuClose = (e: MouseEvent | TouchEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className={theme === "dark" ? `${styles.root} ${styles.rootDark}` : styles.root}
      role="toolbar"
      aria-label="页面缩放"
      onClick={stopMenuClose}
      onMouseDown={stopMenuClose}
    >
      <span className={styles.percent}>{Math.round(zoom * 100)}%</span>
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.btn}
          aria-label="缩小"
          disabled={!canDecrease}
          onClick={onDecrease}
        >
          −
        </button>
        <button
          type="button"
          className={styles.btn}
          aria-label="放大"
          disabled={!canIncrease}
          onClick={onIncrease}
        >
          +
        </button>
        {showReset ? (
          <button type="button" className={`${styles.btn} ${styles.resetBtn}`} onClick={onReset}>
            重置
          </button>
        ) : null}
      </div>
    </div>
  );
}
