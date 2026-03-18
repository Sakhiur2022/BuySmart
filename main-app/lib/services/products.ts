import { createClient } from '@/utils/supabase/client';

export interface Product {
  id: string;
  title: string;
  description?: string;
  price: number;
  category: string;
  image?: string;
  [key: string]: any;
}

export interface FetchProductsOptions {
  nameQuery?: string;
  category?: string;
}

/**
 * Fetch products from the database with optional filters
 * @param nameQuery - Filter by product title (case-insensitive partial match)
 * @param category - Filter by category (exact match)
 * @returns Promise containing array of products
 */
export async function fetchFilteredProducts(
  nameQuery?: string,
  category?: string
): Promise<Product[]> {
  const supabase = createClient();

  let query = supabase.from('products').select('*');

  if (nameQuery && nameQuery.trim()) {
    query = query.ilike('title', `%${nameQuery}%`);
  }

  if (category && category !== 'All') {
    query = query.eq('category', category);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching products:', error);
    throw new Error(`Failed to fetch products: ${error.message}`);
  }

  return data || [];
}

/**
 * Fetch a single product by ID
 */
export async function fetchProductById(id: string): Promise<Product | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching product:', error);
    throw new Error(`Failed to fetch product: ${error.message}`);
  }

  return data || null;
}

/**
 * Get all unique categories
 */
export async function fetchCategories(): Promise<string[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('products')
    .select('category')
    .distinct();

  if (error) {
    console.error('Error fetching categories:', error);
    throw new Error(`Failed to fetch categories: ${error.message}`);
  }

  return data
    ?.map((item: { category: string }) => item.category)
    .filter((cat: string): cat is string => Boolean(cat)) || [];
}
