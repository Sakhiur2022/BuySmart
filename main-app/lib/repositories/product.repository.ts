import type {
  BuyerProductListFilters,
  BuyerProductListItem,
  BuyerProductListResult,
} from '@/lib/models/product.model';
import { createClient } from '@/lib/supabase/server';

interface ProductRow {
  product_id: string;
  name: string;
  price: number;
  images: unknown;
  short_description: string | null;
}

const PRODUCTS_TABLE = 'products';
const PRODUCT_SEARCH_VECTOR_COLUMN = 'search_vector';

function formatListItem(product: ProductRow): BuyerProductListItem {
  const images = Array.isArray(product.images) ? product.images : [];

  return {
    product_id: product.product_id,
    name: product.name,
    price: product.price,
    image: images.length > 0 && typeof images[0] === 'string' ? images[0] : undefined,
    short_description: product.short_description,
  };
}

export async function findBuyerProducts(
  filters: BuyerProductListFilters,
): Promise<BuyerProductListResult> {
  const supabase = await createClient();

  let query = supabase
    .from(PRODUCTS_TABLE)
    .select('product_id, name, price, images, short_description', { count: 'exact' })
    .eq('status', 'active');

  if (filters.priceMin !== undefined) {
    query = query.gte('price', filters.priceMin);
  }

  if (filters.priceMax !== undefined) {
    query = query.lte('price', filters.priceMax);
  }

  if (filters.categoryId !== undefined) {
    query = query.eq('category_id', filters.categoryId);
  }

  if (filters.query) {
    // Required migration note:
    // Add a generated tsvector column named `search_vector` on `products` and keep it indexed.
    // Include name + description + category text in the vector (category may require denormalized category_name).
    // Example: GENERATED ALWAYS AS (to_tsvector('english', coalesce(name,'') || ' ' || coalesce(description,'') || ' ' || coalesce(short_description,'') || ' ' || coalesce(category_name,''))) STORED
    query = query.textSearch(PRODUCT_SEARCH_VECTOR_COLUMN, filters.query, {
      type: 'websearch',
      config: 'english',
    });
  }

  const offset = (filters.page - 1) * filters.pageSize;
  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + filters.pageSize - 1);

  const { data, count, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const products = ((data ?? []) as ProductRow[]).map(formatListItem);
  const totalCount = count ?? 0;
  const totalPages = Math.ceil(totalCount / filters.pageSize);

  return {
    products,
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      totalCount,
      totalPages,
    },
  };
}
