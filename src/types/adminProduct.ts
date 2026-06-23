export type AdminProductRow = {
  id: number;
  name: string;
  price: string;
  renewal_price: string;
  coin: number;
  /** 接口字段名为 bouns */
  bouns: string;
  type: 1 | 2;
  status: 0 | 1;
  extra: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type AdminProductListPayload = {
  data: AdminProductRow[];
  current_page: number;
  per_page: number;
  count: number;
};

/** `POST admin/product/save` */
export type AdminProductSaveBody = {
  id: number;
  name: string;
  price: string;
  renewal_price?: string;
  /** 金币产品赠送比例，接口字段名为 bouns */
  bouns?: string;
  /** 金币产品金币数量 */
  coin?: number;
  status: 0 | 1;
};
