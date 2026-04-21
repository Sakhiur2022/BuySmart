import { Metadata } from 'next';
import ProductListingPage from '@/components/products/product-listing-page';
import { getBuyerProductsAction } from '@/lib/actions/buyer-products.actions';
import { getActiveCategories } from '@/lib/controllers/category.controller';
import type { BuyerProductListItem, BuyerProductPagination } from '@/lib/models/product.model';

// ============================================================================
// TYPES
// ============================================================================

interface Category {
  category_id: number;
  name: string;
}

interface PageProps {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    priceMin?: string;
    priceMax?: string;
    categoryId?: string;
    category?: string;
    q?: string;
    search?: string;
  }>;
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

// ============================================================================
// METADATA
// ============================================================================

export const metadata: Metadata = {
  title: 'Browse Products | BuySmart',
  description:
    'Explore our wide selection of products. Filter by price, category, and more to find exactly what you need.',
  robots: 'index, follow',
};

// ============================================================================
// SERVER COMPONENT
// ============================================================================

export default async function BuyerProductsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = params.q ?? params.search;

  const categoriesData = await getActiveCategories().catch((error: unknown) => {
    console.error('Error loading products categories:', error);
    throw error;
  });

  const categories: Category[] = categoriesData.map((cat) => ({
    category_id: cat.category_id,
    name: cat.name,
  }));

  const normalizedCategoryName = params.category?.trim().toLowerCase();
  const categoryMatch = normalizedCategoryName
    ? categories.find((cat) => cat.name.trim().toLowerCase() === normalizedCategoryName)
    : undefined;
  const resolvedCategoryId = parseOptionalNumber(params.categoryId) ?? categoryMatch?.category_id;

  const productsResult = await getBuyerProductsAction({
    page: parseOptionalNumber(params.page),
    pageSize: parseOptionalNumber(params.pageSize),
    priceMin: parseOptionalNumber(params.priceMin),
    priceMax: parseOptionalNumber(params.priceMax),
    categoryId: resolvedCategoryId,
    q: query,
  }).catch((error: unknown) => {
    console.error('Error loading products page:', error);
    throw error;
  });

  const products = productsResult.products as BuyerProductListItem[];
  const pagination = productsResult.pagination as BuyerProductPagination;

  return (
    <ProductListingPage
      initialProducts={products}
      initialPagination={pagination}
      categories={categories}
      initialFilters={{
        priceMin: parseOptionalNumber(params.priceMin),
        priceMax: parseOptionalNumber(params.priceMax),
        categoryId: resolvedCategoryId,
        query,
      }}
    />
  );
}
