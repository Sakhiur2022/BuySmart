import { useEffect, useState } from 'react';
import type { Category } from '@/lib/models/category.model';
import { createClient } from '@/lib/supabase/client';

export function useSellerCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCategories() {
      const supabase = createClient();

      const { data, error } = await supabase
        .from('categories')
        .select('category_id, name')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Failed to load categories for chatbot:', error);
        setCategories([]);
      } else {
        setCategories((data as Category[] | null) || []);
      }
      setLoading(false);
    }

    loadCategories();
  }, []);

  return { categories, loading };
}
