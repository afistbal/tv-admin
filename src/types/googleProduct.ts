export type GoogleProductPlatform = "ios" | "android" | "tk";

export type GoogleProductRow = {
  id: number;
  platform: GoogleProductPlatform;
  pkg_name: string;
  google_product_id: string;
  base_plan_id: string | null;
  name: string;
  price: string;
  first_price: string;
  coin: number;
  bonus: number;
  type: 1 | 2;
  product_type_name: "purchase" | "subscription" | string;
  price_type: 0 | 1;
  status: 0 | 1;
  extra: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

export type GoogleProductListPayload = {
  data: GoogleProductRow[];
  current_page: number;
  per_page: number;
  count: number;
  next_page_url?: string | null;
  prev_page_url?: string | null;
};

/** `POST admin/google-product/save` */
export type GoogleProductSaveBody = {
  id: number;
  name?: string;
  price?: string;
  first_price?: string;
  coin?: number;
  bonus?: number;
  status?: 0 | 1;
};
