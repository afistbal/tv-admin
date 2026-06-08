import { useCallback, useState } from "react";

const STORAGE_KEY = "h5-page-zoom";

export const PAGE_ZOOM_MIN = 0.5;
export const PAGE_ZOOM_MAX = 1;
export const PAGE_ZOOM_DEFAULT = 1;
export const PAGE_ZOOM_STEP = 0.05;

function clampZoom(value: number): number {
  return Math.min(PAGE_ZOOM_MAX, Math.max(PAGE_ZOOM_MIN, value));
}

function roundZoom(value: number): number {
  return Math.round(value / PAGE_ZOOM_STEP) * PAGE_ZOOM_STEP;
}

function readStoredZoom(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null || raw === "") {
      return PAGE_ZOOM_DEFAULT;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      return PAGE_ZOOM_DEFAULT;
    }
    return clampZoom(roundZoom(n));
  } catch {
    return PAGE_ZOOM_DEFAULT;
  }
}

export function usePageZoom() {
  const [zoom, setZoomState] = useState(readStoredZoom);

  const setZoom = useCallback((next: number) => {
    const value = clampZoom(roundZoom(next));
    setZoomState(value);
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      /* ignore */
    }
  }, []);

  const decrease = useCallback(() => {
    setZoom(zoom - PAGE_ZOOM_STEP);
  }, [setZoom, zoom]);

  const increase = useCallback(() => {
    setZoom(zoom + PAGE_ZOOM_STEP);
  }, [setZoom, zoom]);

  const reset = useCallback(() => {
    setZoom(PAGE_ZOOM_DEFAULT);
  }, [setZoom]);

  return {
    zoom,
    decrease,
    increase,
    reset,
    canDecrease: zoom > PAGE_ZOOM_MIN,
    canIncrease: zoom < PAGE_ZOOM_MAX,
  };
}
