'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

interface Product {
  product_id: string;
  id: string;
  name: string;
  description?: string | null;
  price: number;
  images?: any;
  category_id?: number | null;
}

interface SearchState {
  query: string;
  category: string;
}

interface CategoryOption {
  category_id: number;
  name: string;
}

function getProductImage(product: Product) {
  if (!product.images) {
    return 'https://via.placeholder.com/300';
  }

  if (typeof product.images === 'string') {
    return product.images;
  }

  if (Array.isArray(product.images) && product.images.length > 0) {
    return product.images[0]?.url || product.images[0];
  }

  if (typeof product.images === 'object' && product.images?.url) {
    return product.images.url;
  }

  return 'https://via.placeholder.com/300';
}

function ProductCard({ product, viewMode }: { product: Product; viewMode: 'grid' | 'list' }) {
  return (
    <div
      className={`bg-card text-card-foreground border border-border rounded-2xl overflow-hidden shadow-sm transition hover:shadow-md ${
        viewMode === 'list' ? 'flex h-44' : 'flex flex-col'
      }`}
    >
      <div className={viewMode === 'list' ? 'w-48 shrink-0' : 'h-48 w-full'}>
        <img
          src={getProductImage(product)}
          alt={product.name}
          className="h-full w-full object-cover"
        />
      </div>

      <div className="flex flex-1 flex-col justify-between p-4">
        <div>
          <h3 className="text-base font-semibold leading-tight">{product.name}</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground line-clamp-3">
            {product.description || 'No description available.'}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between gap-4 text-sm font-medium">
          <span className="text-primary">${product.price.toFixed(2)}</span>
          <button className="rounded-full bg-primary px-4 py-2 text-primary-foreground transition hover:bg-primary/90">
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProductController() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState<SearchState>({ query: '', category: 'All' });
  const [categories, setCategories] = useState<CategoryOption[]>([
    { category_id: -1, name: 'All' },
  ]);

  const loadCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('category_id, name')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (!error && data) {
      setCategories([{ category_id: -1, name: 'All' }, ...data]);
    }
  }, []);

  const loadData = useCallback(
    async (filters: SearchState) => {
      setLoading(true);

      let query = supabase.from('products').select('*');

      if (filters.query.trim()) {
        query = query.ilike('name', `%${filters.query}%`);
      }

      if (filters.category !== 'All') {
        const selectedCategory = categories.find((category) => category.name === filters.category);
        if (selectedCategory && selectedCategory.category_id !== -1) {
          query = query.eq('category_id', selectedCategory.category_id);
        }
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (!error && data) {
        setProducts(
          data.map((product: any) => ({
            ...product,
            id: product.product_id,
          })) as Product[],
        );
      } else {
        setProducts([]);
      }

      setLoading(false);
    },
    [categories],
  );

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadData(search), 300);
    return () => window.clearTimeout(timer);
  }, [search, loadData]);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm md:flex-row">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search items..."
            value={search.query}
            onChange={(event) => setSearch((prev) => ({ ...prev, query: event.target.value }))}
            className="w-full rounded-md border border-input bg-background px-4 py-2 pr-10 text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="pointer-events-none absolute left-3 top-2.5 text-muted-foreground">🔍</span>
        </div>

        <select
          value={search.category}
          onChange={(event) => setSearch((prev) => ({ ...prev, category: event.target.value }))}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none cursor-pointer"
        >
          {categories.map((category) => (
            <option key={category.category_id} value={category.name}>
              {category.name}
            </option>
          ))}
        </select>

        <div className="flex overflow-hidden rounded-md border border-input shadow-2xs">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`px-4 py-2 text-sm transition-colors ${
              viewMode === 'grid'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-card-foreground hover:bg-muted'
            }`}
          >
            Grid
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 text-sm transition-colors ${
              viewMode === 'list'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-card-foreground hover:bg-muted'
            }`}
          >
            List
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4 animate-pulse">
          {[1, 2, 3, 4].map((index) => (
            <div key={index} className="h-64 rounded-lg bg-muted" />
          ))}
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4' : 'space-y-4'}>
          {products.map((product) => (
            <ProductCard key={product.id} product={product} viewMode={viewMode} />
          ))}
        </div>
      )}
    </div>
  );
}
