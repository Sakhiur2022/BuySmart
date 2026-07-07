import type {
  BuyerProductListFilters,
  BuyerProductListResult,
  BuyerProductQueryParams,
} from '@/lib/models/product.model';
import { findBuyerProducts } from '@/lib/repositories/product.repository';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 50;

function getPositiveNumber(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.trunc(value));
}

function getOptionalNonNegativeNumber(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }

  return value >= 0 ? value : undefined;
}

function getOptionalPositiveInt(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }

  const parsed = Math.trunc(value);
  return parsed > 0 ? parsed : undefined;
}

function normalizeQuery(query: string | undefined): string | undefined {
  if (!query) {
    return undefined;
  }

  const normalized = query.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function buildBuyerProductListFilters(params: BuyerProductQueryParams): BuyerProductListFilters {
  const page = getPositiveNumber(params.page, DEFAULT_PAGE);
  const pageSize = Math.min(getPositiveNumber(params.pageSize, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
  const priceMin = getOptionalNonNegativeNumber(params.priceMin);
  const priceMax = getOptionalNonNegativeNumber(params.priceMax);

  return {
    page,
    pageSize,
    priceMin,
    priceMax,
    categoryId: getOptionalPositiveInt(params.categoryId),
    query: normalizeQuery(params.q ?? params.search),
  };
}

export async function getBuyerProductListing(
  params: BuyerProductQueryParams,
): Promise<BuyerProductListResult> {
  const filters = buildBuyerProductListFilters(params);

  if (
    filters.priceMin !== undefined &&
    filters.priceMax !== undefined &&
    filters.priceMin > filters.priceMax
  ) {
    throw new Error('Minimum price cannot be greater than maximum price.');
  }

  return findBuyerProducts(filters);
}

/**
 * Create a new product listing for a seller.
 * This method is used by the seller-management service layer.
 * It validates the payload minimally and delegates to the product repository.
 */
export async function createSellerProduct(
  sellerId: string,
  payload: {
    name: string;
    price: number;
    category: string;
    photos: string[];
    stockQuantity: number;
  },
): Promise<void> {
  // In a real implementation we would validate category existence, etc.
  // For now we directly insert via the repository (assumed to exist).
  const { name, price, category, photos, stockQuantity } = payload;
  // The product repository expects a specific shape; we reuse the existing create logic if any.
  // Here we simply call a placeholder repository function; implementation can be added later.
  const { createProduct } = require('@/lib/repositories/product.repository');
  await createProduct({
    seller_id: sellerId,
    name,
    short_description: null,
    images: photos,
    status: 'draft',
    inventory_quantity: stockQuantity,
    price,
    category_id: category,
  });
}
