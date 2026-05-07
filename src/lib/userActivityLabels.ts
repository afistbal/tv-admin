/** 与 slot_old ActivityLog 中 ACTIVITY_TYPE 一致（简体中文） */
export const ACTIVITY_ACTION_LABEL: Record<string, string> = {
  alive: "留存",
  deny: "拒绝访问",
  deny_source: "拒绝的来源",
  list_product: "列出产品",
  load_duration: "加载时间",
  load_duration_page: "页面加载时间",
  login: "登录",
  order_active: "订单已激活",
  order_complete: "订单处理完毕",
  pay_product: "付款产品",
  play: "播放",
  play_episode: "播放剧集",
  share: "分享页",
  source: "来源",
  subscription_active: "订阅已激活",
  subscription_cancelled: "订阅已取消",
};

export function activityActionLabel(action: string): string {
  return ACTIVITY_ACTION_LABEL[action.toLowerCase()] ?? action.toUpperCase();
}
