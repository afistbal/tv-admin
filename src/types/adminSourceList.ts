/** `GET admin/source/list`：`d` 为数组 */
export type AdminSourceRow = {
  id: number;
  source: string;
  type: string;
  status: number;
  source_id: string;
  created_at?: string | null;
  updated_at?: string | null;
};

/** 编辑 / 新增弹窗 */
export type AdminSourceFormRow = {
  id?: number;
  source?: string;
  type?: string;
  status?: number;
  source_id?: string;
};
