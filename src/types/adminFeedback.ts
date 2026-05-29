/** GET `admin/feedback`：用户反馈列表 */

export type AdminFeedbackRow = {
  id: number;
  user_id?: number;
  email?: string;
  content?: string;
  created_at?: string;
};

export type AdminFeedbackListPayload = {
  data: AdminFeedbackRow[];
  current_page: number;
  per_page: number;
  count: number;
};
