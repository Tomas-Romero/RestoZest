import { apiRequest } from "./api";

export type Category = {
  id: string;
  venueId: string;
  name: string;
  position: number;
  deletedAt: string | null;
  updatedAt: string;
};

export type ProductKind = "food" | "drink" | "combo";
export type PrepStation = "kitchen" | "bar" | "grill";

export type Product = {
  id: string;
  venueId: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  basePriceCents: number;
  costCents: number | null;
  kind: ProductKind;
  prepStation: PrepStation;
  tracksStock: boolean;
  available: boolean;
  tags: string[];
  position: number;
  deletedAt: string | null;
  updatedAt: string;
};

export type ProductVariant = {
  id: string;
  venueId: string;
  productId: string;
  name: string;
  priceDeltaCents: number;
  position: number;
  deletedAt: string | null;
  updatedAt: string;
};

export type ProductInput = {
  categoryId?: string | null;
  name: string;
  description?: string | null;
  basePriceCents: number;
  costCents?: number | null;
  kind?: ProductKind;
  prepStation?: PrepStation;
  tracksStock?: boolean;
  available?: boolean;
  tags?: string[];
  position?: number;
};

export type VariantInput = {
  name: string;
  priceDeltaCents?: number;
  position?: number;
};

export function fetchCategories(venueId: string): Promise<Category[]> {
  return apiRequest(`/venues/${venueId}/categories`);
}

export function createCategory(venueId: string, name: string): Promise<Category> {
  return apiRequest(`/venues/${venueId}/categories`, { method: "POST", body: JSON.stringify({ name }) });
}

export function renameCategory(venueId: string, categoryId: string, name: string): Promise<Category> {
  return apiRequest(`/venues/${venueId}/categories/${categoryId}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export function reorderCategory(venueId: string, categoryId: string, position: number): Promise<Category> {
  return apiRequest(`/venues/${venueId}/categories/${categoryId}`, {
    method: "PATCH",
    body: JSON.stringify({ position }),
  });
}

export function deleteCategory(venueId: string, categoryId: string): Promise<void> {
  return apiRequest(`/venues/${venueId}/categories/${categoryId}`, { method: "DELETE" });
}

export function fetchProducts(venueId: string): Promise<Product[]> {
  return apiRequest(`/venues/${venueId}/products`);
}

export function createProduct(venueId: string, input: ProductInput): Promise<Product> {
  return apiRequest(`/venues/${venueId}/products`, { method: "POST", body: JSON.stringify(input) });
}

export function updateProduct(venueId: string, productId: string, input: Partial<ProductInput>): Promise<Product> {
  return apiRequest(`/venues/${venueId}/products/${productId}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function reorderProduct(venueId: string, productId: string, position: number): Promise<Product> {
  return updateProduct(venueId, productId, { position });
}

export function deleteProduct(venueId: string, productId: string): Promise<void> {
  return apiRequest(`/venues/${venueId}/products/${productId}`, { method: "DELETE" });
}

export function fetchVariants(venueId: string, productId: string): Promise<ProductVariant[]> {
  return apiRequest(`/venues/${venueId}/products/${productId}/variants`);
}

export function createVariant(venueId: string, productId: string, input: VariantInput): Promise<ProductVariant> {
  return apiRequest(`/venues/${venueId}/products/${productId}/variants`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateVariant(
  venueId: string,
  productId: string,
  variantId: string,
  input: Partial<VariantInput>,
): Promise<ProductVariant> {
  return apiRequest(`/venues/${venueId}/products/${productId}/variants/${variantId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteVariant(venueId: string, productId: string, variantId: string): Promise<void> {
  return apiRequest(`/venues/${venueId}/products/${productId}/variants/${variantId}`, { method: "DELETE" });
}

export type RoundingOption = 10 | 50 | 100;

export type PriceChangeBatch = {
  id: string;
  venueId: string;
  rule: { scope: "all" | "category" | "tag"; categoryId?: string; tag?: string; op: "percent" | "fixed"; percent?: number; amountCents?: number; rounding?: RoundingOption };
  snapshot: Record<string, number>;
  appliedBy: string;
  appliedAt: string;
  revertedAt: string | null;
};

export type ApplyBatchInput =
  | { scope: "all"; op: "percent"; percent: number; rounding?: RoundingOption }
  | { scope: "all"; op: "fixed"; amountCents: number; rounding?: RoundingOption }
  | { scope: "category"; categoryId: string; op: "percent"; percent: number; rounding?: RoundingOption }
  | { scope: "category"; categoryId: string; op: "fixed"; amountCents: number; rounding?: RoundingOption }
  | { scope: "tag"; tag: string; op: "percent"; percent: number; rounding?: RoundingOption }
  | { scope: "tag"; tag: string; op: "fixed"; amountCents: number; rounding?: RoundingOption };

export function fetchPriceChangeBatches(venueId: string): Promise<PriceChangeBatch[]> {
  return apiRequest(`/venues/${venueId}/price-change-batches`);
}

export function applyPriceChangeBatch(
  venueId: string,
  input: ApplyBatchInput,
): Promise<{ batch: PriceChangeBatch; affectedCount: number }> {
  return apiRequest(`/venues/${venueId}/price-change-batches`, { method: "POST", body: JSON.stringify(input) });
}

export function revertPriceChangeBatch(venueId: string, batchId: string): Promise<PriceChangeBatch> {
  return apiRequest(`/venues/${venueId}/price-change-batches/${batchId}/revert`, { method: "POST" });
}
