export type AdminTagCategory = {
  id: number;
  slug: string;
  name: string;
};

export type AdminTagCategoryMappingRow = {
  tag_id: number;
  tag_name: string;
  unique_id: string;
  category: AdminTagCategory | null;
  sort: number;
  movie_count: number;
  created_at: string;
  updated_at: string;
};

export type AdminTagCategoryMappingSummary = {
  total_tags: number;
  unmapped_tags: number;
};

export type AdminTagCategoryMappingsPayload = {
  data: AdminTagCategoryMappingRow[];
  current_page: number;
  per_page: number;
  count: number;
  summary?: AdminTagCategoryMappingSummary;
};

export type AdminTagCategorySavePayload = {
  tag: string;
  category_id: number;
  sort: number;
  affected_movie_tags: number;
};
