/** 与 `BasicLayout` 主内容滚动区 `#admin-main-scroll` 配合，纵向滚动时固定表头 */
export const MAIN_CONTENT_SCROLL_ID = "admin-main-scroll";

export const mainContentTableSticky = {
  offsetHeader: 0,
  getContainer: () => document.getElementById(MAIN_CONTENT_SCROLL_ID) ?? window,
};
