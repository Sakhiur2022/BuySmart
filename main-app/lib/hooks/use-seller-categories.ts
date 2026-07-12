import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function useSellerCategories() {
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCategories() {
      const supabase = createClient();

      const { data, error } = await supabase
        .from('categories')
        .select('name')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Failed to load categories for chatbot:', error);
        setCategories([]);
      } else {
        setCategories(data?.map((c) => c.name) || []);
      }
      setLoading(false);
    }

    loadCategories();
  }, []);

  return { categories, loading };
}
