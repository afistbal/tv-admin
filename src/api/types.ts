/** 与 slot_old 接口约定一致：`c === 0` 成功 */
export type ApiResult<T> = {
  c: number;
  m: string;
  d: T;
};
