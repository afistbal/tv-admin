export type ProductDiscount = {
  type: number;
  price: string;
};

export type ProductExtra = {
  discounts?: ProductDiscount[];
  [key: string]: unknown;
};

export function parseProductExtra(raw: unknown): ProductExtra {
  if (typeof raw !== "string" || !raw.trim()) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed != null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as ProductExtra;
    }
  } catch {
    /* ignore malformed extra */
  }
  return {};
}

export function productDiscountsFromExtra(raw: unknown): ProductDiscount[] {
  const extra = parseProductExtra(raw);
  if (!Array.isArray(extra.discounts)) {
    return [];
  }
  return extra.discounts
    .map((item) => {
      if (item == null || typeof item !== "object") {
        return null;
      }
      const record = item as Record<string, unknown>;
      const type = Number(record.type);
      const price = String(record.price ?? "").trim();
      if (!Number.isFinite(type) || !price) {
        return null;
      }
      return { type, price };
    })
    .filter((item): item is ProductDiscount => item != null)
    .sort((a, b) => a.type - b.type);
}

export function productDiscountSummary(raw: unknown): string[] {
  return productDiscountsFromExtra(raw).map((item) => `优惠价${item.type}：${item.price}`);
}

export function stringifyProductExtraWithDiscounts(raw: unknown, discounts: ProductDiscount[]): string | undefined {
  const extra = parseProductExtra(raw);
  const cleanedDiscounts = discounts
    .map((item) => ({
      type: Number(item.type),
      price: String(item.price ?? "").trim(),
    }))
    .filter((item) => Number.isFinite(item.type) && item.price)
    .sort((a, b) => a.type - b.type);

  if (cleanedDiscounts.length > 0) {
    extra.discounts = cleanedDiscounts;
  } else {
    delete extra.discounts;
  }

  if (Object.keys(extra).length > 0) {
    return JSON.stringify(extra);
  }
  return typeof raw === "string" && raw.trim() ? "{}" : undefined;
}
