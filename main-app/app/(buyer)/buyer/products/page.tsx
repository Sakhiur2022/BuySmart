import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import ProductListingPage from '@/components/products/product-listing-page';

// ============================================================================
// TYPES
// ============================================================================

interface Category {
  category_id: number;
  name: string;
  slug: string;
}

interface ProductItem {
  product_id: string;
  name: string;
  price: number;
  image: string | undefined;
  short_description: string | null;
}

interface PageProps {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    priceMin?: string;
    priceMax?: string;
    categoryId?: string;
    search?: string;
  }>;
}

// ============================================================================
// METADATA
// ============================================================================

export const metadata: Metadata = {
  title: 'Browse Products | BuySmart',
  description: 'Explore our wide selection of products. Filter by price, category, and more to find exactly what you need.',
  robots: 'index, follow',
};

// ============================================================================
// SERVER COMPONENT
// ============================================================================

export default async function BuyerProductsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = parseInt(params.page || '1', 10);
  const pageSize = parseInt(params.pageSize || '12', 10);

  try {
    // Fetch categories
    const supabase = await createClient();
    const { data: categoriesData, error: categoriesError } = await supabase
      .from('categories')
      .select('category_id, name, slug')
      .order('name', { ascending: true });

    if (categoriesError) {
      console.error('Failed to fetch categories:', categoriesError);
    }

    const categories: Category[] = (categoriesData || []).map((cat) => ({
      category_id: cat.category_id as number,
      name: cat.name as string,
      slug: cat.slug as string,
    }));

    // Build query string for initial products fetch
    const queryParams = new URLSearchParams();
    queryParams.append('page', String(page));
    queryParams.append('pageSize', String(pageSize));

    if (params.priceMin) queryParams.append('priceMin', params.priceMin);
    if (params.priceMax) queryParams.append('priceMax', params.priceMax);
    if (params.categoryId) queryParams.append('categoryId', params.categoryId);
    if (params.search) queryParams.append('search', params.search);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const productsUrl = `${appUrl}/api/products?${queryParams.toString()}`;

    const productsResponse = await fetch(productsUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (!productsResponse.ok) {
      console.error('Failed to fetch products:', productsResponse.statusText);
      throw new Error('Failed to fetch products');
    }

    const productsData = await productsResponse.json();
    const { products, pagination } = productsData;

    return (
      <ProductListingPage
        initialProducts={products as ProductItem[]}
        initialPagination={pagination}
        categories={categories}
        initialFilters={{
          priceMin: params.priceMin ? Number(params.priceMin) : undefined,
          priceMax: params.priceMax ? Number(params.priceMax) : undefined,
          categoryId: params.categoryId ? Number(params.categoryId) : undefined,
        }}
      />
    );
  } catch (error) {
    console.error('Error loading products page:', error);
    throw error;
  }
}
