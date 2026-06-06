/** GET `admin/feedback`：用户反馈列表 */

/** `status`：0 未处理，1 已处理 */
export type AdminFeedbackStatus = 0 | 1;

export const ADMIN_FEEDBACK_STATUS_OPTIONS: { value: AdminFeedbackStatus; label: string }[] = [
  { value: 0, label: "未处理" },
  { value: 1, label: "已处理" },
];

/** POST `admin/feedback/status` */
export type AdminFeedbackStatusUpdateBody = {
  ids: number[];
  status: AdminFeedbackStatus;
};

export type AdminFeedbackRow = {
  id: number;
  user_id?: number;
  email?: string;
  content?: string;
  status?: AdminFeedbackStatus | number;
  created_at?: string;
};

export type AdminFeedbackListPayload = {
  data: AdminFeedbackRow[];
  current_page: number;
  per_page: number;
  count: number;
};
