'use client';

import { useEffect, useState } from 'react';
import type { Product } from '@/lib/chatbot/types';
import { createClient } from '@/lib/supabase/client';
import type { AIParams } from '@/lib/chatbot/types';

export function useProductSearch(params?: AIParams, userId?: string) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchProducts = async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      
      let query = supabase
        .from('products')
        .select(`
          product_id,
          name,
          price,
          description,
          images,
          inventory_quantity,
          categories!inner (
            name
          ),
          tags,
          seller_id
        `)
        .eq('status', 'active')
        .eq('inventory_tracked', true)
        .gt('inventory_quantity', 0);

      // Filter by category
      if (params?.category) {
        query = query.ilike('categories.name', `%${params.category}%`);
      }

      // Filter by price range
      if (params?.price_max) {
        query = query.lte('price', params.price_max);
      }
      if (params?.price_min) {
        query = query.gte('price', params.price_min);
      }

      // Filter by features/tags
      if (params?.features && params.features.length > 0) {
        const featureConditions = params.features.map(feature => 
          `tags.ilike.%${feature}%,description.ilike.%${feature}%`
        ).join(',');
        query = query.or(featureConditions);
      }

      // If userId is provided, you might want to filter by seller's products
      // or apply other user-specific logic
      if (userId) {
        // Example: Only show products from specific sellers or apply user preferences
        // query = query.eq('seller_id', userId);
      }

      const { data, error: fetchError } = await query.limit(10);

      if (fetchError) {
        throw fetchError;
      }

      if (!data || data.length === 0) {
        setProducts([]);
        return;
      }

      // Transform Supabase data to Product format
      const transformedProducts: Product[] = data.map((item: any) => ({
        id: item.product_id,
        name: item.name,
        price: item.price,
        category: item.categories?.name || 'uncategorized',
        images: item.images || [],
        stock_available: item.inventory_quantity > 0,
        features: item.tags || [],
        badge: item.inventory_quantity > 10 ? 'In Stock' : 'Low Stock',
        emoji: getCategoryEmoji(item.categories?.name),
      }));

      setProducts(transformedProducts);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search products';
      setError(errorMessage);
      console.error('Product search error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    searchProducts();
  }, [params?.category, params?.price_max, params?.price_min, params?.features, userId]);

  return { products, loading, error, refetch: searchProducts };
}

function getCategoryEmoji(categoryName?: string): string {
  const category = categoryName?.toLowerCase() || '';
  if (category.includes('phone') || category.includes('mobile')) return '📱';
  if (category.includes('laptop') || category.includes('computer')) return '💻';
  if (category.includes('headphone') || category.includes('audio')) return '🎧';
  if (category.includes('watch')) return '⌚';
  if (category.includes('camera')) return '📷';
  if (category.includes('tablet')) return '📱';
  return '📦';
}