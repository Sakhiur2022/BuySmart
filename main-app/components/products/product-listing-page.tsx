'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Grid3x3, List, ChevronLeft, ChevronRight, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

interface Product {
  product_id: string;
  name: string;
  price: number;
  image?: string;
  category_id?: number | null;
  short_description?: string | null;
}

interface Category {
  category_id: number;
  name: string;
  slug: string;
}

interface Pagination {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

interface InitialFilters {
  priceMin?: number;
  priceMax?: number;
  categoryId?: number;
}

interface ProductListingPageProps {
  categories: Category[];
  initialProducts: Product[];
  initialPagination: Pagination;
  initialFilters?: InitialFilters;
}

type ViewMode = 'grid' | 'list';

/**
 * Product Listing Page Component
 * Displays products with filtering by price and category, with grid/list toggle
 */
export default function ProductListingPage({
  categories,
  initialProducts,
  initialPagination,
  initialFilters = {},
}: ProductListingPageProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [currentPage, setCurrentPage] = useState(initialPagination.page);
  const [pageSize, setPageSize] = useState(initialPagination.pageSize);
  const [priceMin, setPriceMin] = useState<string>(initialFilters.priceMin ? String(initialFilters.priceMin) : '');
  const [priceMax, setPriceMax] = useState<string>(initialFilters.priceMax ? String(initialFilters.priceMax) : '');
  const [categoryId, setCategoryId] = useState<string>(initialFilters.categoryId ? String(initialFilters.categoryId) : 'all');
  const [products, setProducts] = useState(initialProducts);
  const [pagination, setPagination] = useState(initialPagination);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate total pages from pagination
  const totalPages = pagination.totalPages;
  const totalCount = pagination.totalCount;

  // Load products with current filters
  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
      });

      if (priceMin) params.append('priceMin', priceMin);
      if (priceMax) params.append('priceMax', priceMax);
      if (categoryId && categoryId !== 'all') params.append('categoryId', categoryId);

      const response = await fetch(`/api/products?${params}`);
      if (!response.ok) throw new Error('Failed to fetch products');

      const data = (await response.json()) as {
        products: Product[];
        pagination: Pagination;
      };
      setProducts(data.products);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, priceMin, priceMax, categoryId]);

  // Load products when filters change
  useEffect(() => {
    setCurrentPage(1); // Reset to first page when filters change
  }, [priceMin, priceMax, categoryId, pageSize]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Active filter display
  const activeFilters = useMemo(() => {
    const filters = [];
    if (priceMin || priceMax) {
      filters.push(`Price: $${priceMin || '0'} - $${priceMax || '∞'}`);
    }
    const selectedCategory = categories.find((c) => c.category_id.toString() === categoryId);
    if (selectedCategory && categoryId !== 'all') {
      filters.push(`Category: ${selectedCategory.name}`);
    }
    return filters;
  }, [priceMin, priceMax, categoryId, categories]);

  const handleClearFilters = () => {
    setPriceMin('');
    setPriceMax('');
    setCategoryId('all');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Browse Products</h1>
        <p className="text-muted-foreground">Find the perfect product from our catalog</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Filters Sidebar */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Price Range */}
              <div className="space-y-3">
                <Label className="font-semibold">Price Range</Label>
                <div className="space-y-2">
                  <Input
                    type="number"
                    placeholder="Min price"
                    value={priceMin}
                    onChange={(e) => setPriceMin(e.target.value)}
                    className="text-sm"
                  />
                  <Input
                    type="number"
                    placeholder="Max price"
                    value={priceMax}
                    onChange={(e) => setPriceMax(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>

              <Separator />

              {/* Category Filter */}
              <div className="space-y-3">
                <Label className="font-semibold">Category</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.category_id} value={cat.category_id.toString()}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Clear Filters */}
              {activeFilters.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={handleClearFilters}
                >
                  Clear all filters
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Products Section */}
        <div className="lg:col-span-3 space-y-4">
          {/* Top Bar: View Mode Toggle + Page Size */}
          <div className="flex items-center justify-between gap-4 bg-muted/50 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                title="Grid view"
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                title="List view"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Label htmlFor="page-size" className="text-sm">
                Show:
              </Label>
              <Select value={pageSize.toString()} onValueChange={(v) => setPageSize(parseInt(v))}>
                <SelectTrigger id="page-size" className="w-20 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">6</SelectItem>
                  <SelectItem value="12">12</SelectItem>
                  <SelectItem value="24">24</SelectItem>
                  <SelectItem value="48">48</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active Filters Display */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Active filters:</span>
              {activeFilters.map((filter) => (
                <Badge key={filter} variant="secondary" className="gap-1">
                  {filter}
                  <X className="h-3 w-3" />
                </Badge>
              ))}
            </div>
          )}

          {/* Products Grid/List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="space-y-2 text-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary mx-auto" />
                <p className="text-sm text-muted-foreground">Loading products...</p>
              </div>
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/50 p-12 text-center">
              <p className="text-muted-foreground">No products found matching your filters.</p>
              {activeFilters.length > 0 && (
                <Button
                  variant="link"
                  size="sm"
                  className="mt-2"
                  onClick={handleClearFilters}
                >
                  Try clearing filters
                </Button>
              )}
            </div>
          ) : (
            <div
              className={
                viewMode === 'grid'
                  ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'
                  : 'space-y-3'
              }
            >
              {products.map((product) => (
                <ProductCard
                  key={product.product_id}
                  product={product}
                  isListView={viewMode === 'list'}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-between border-t pt-6">
              <div className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * pageSize + 1} to{' '}
                {Math.min(currentPage * pageSize, totalCount)} of {totalCount} products
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                    const pageNum = i + Math.max(1, currentPage - 2);
                    if (pageNum > totalPages) return null;
                    return (
                      <Button
                        key={pageNum}
                        variant={pageNum === currentPage ? 'default' : 'outline'}
                        size="sm"
                        className="w-10"
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ProductCardProps {
  product: Product;
  isListView?: boolean;
}

function ProductCard({ product, isListView }: ProductCardProps) {
  return (
    <Link href={`/buyer/products/${product.product_id}`} className="group">
      {isListView ? (
        <Card className="transition-all hover:shadow-md">
          <CardContent className="p-4">
            <div className="flex gap-4">
              <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                {product.image ? (
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    className="object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    No image
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                  {product.name}
                </h3>
                {product.short_description && (
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                    {product.short_description}
                  </p>
                )}
                <div className="mt-2 text-lg font-bold text-primary">
                  ${product.price.toFixed(2)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden transition-all hover:shadow-md h-full">
          <div className="relative aspect-square overflow-hidden bg-muted">
            {product.image ? (
              <Image
                src={product.image}
                alt={product.name}
                fill
                className="object-cover transition-transform group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No image
              </div>
            )}
          </div>
          <CardContent className="p-4">
            <h3 className="font-semibold line-clamp-2 group-hover:text-primary transition-colors">
              {product.name}
            </h3>
            {product.short_description && (
              <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                {product.short_description}
              </p>
            )}
            <div className="mt-3 text-lg font-bold text-primary">${product.price.toFixed(2)}</div>
          </CardContent>
        </Card>
      )}
    </Link>
  );
}
