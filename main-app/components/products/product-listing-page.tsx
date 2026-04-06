'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Grid3x3, List, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

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
import ProductSearchInput from '@/components/products/product-search-input';
import { formatCurrency } from '@/lib/utils';

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
  query?: string;
}

interface ProductListingPageProps {
  categories: Category[];
  initialProducts: Product[];
  initialPagination: Pagination;
  initialFilters?: InitialFilters;
}

interface RecommendedItem {
  productId: string;
  title: string;
  reason: string;
  score: number;
  price?: number;
}

interface RecommendedCardItem extends RecommendedItem {
  image?: string;
  name: string;
  productPrice?: number;
}

interface RecommendationEventDetail {
  summary: string;
  items: RecommendedItem[];
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
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [currentPage, setCurrentPage] = useState<number>(initialPagination.page);
  const [pageSize, setPageSize] = useState<number>(initialPagination.pageSize);
  const [priceMin, setPriceMin] = useState<string>(
    initialFilters.priceMin ? String(initialFilters.priceMin) : '',
  );
  const [priceMax, setPriceMax] = useState<string>(
    initialFilters.priceMax ? String(initialFilters.priceMax) : '',
  );
  const [categoryId, setCategoryId] = useState<string>(
    initialFilters.categoryId ? String(initialFilters.categoryId) : 'all',
  );
  const [searchQuery, setSearchQuery] = useState<string>(initialFilters.query ?? '');
  const [recommendationSummary, setRecommendationSummary] = useState<string | null>(null);
  const [recommendedItems, setRecommendedItems] = useState<RecommendedItem[]>([]);
  const [hasRecommendationResponse, setHasRecommendationResponse] = useState(false);

  const [isGeneratingRecommendations, setIsGeneratingRecommendations] = useState(false);

  const formatFilterValue = (value: string, fallback: string) => {
    if (!value.trim()) {
      return fallback;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? formatCurrency(parsed) : fallback;
  };

  const products = initialProducts;
  const pagination = initialPagination;
  const totalPages = pagination.totalPages;
  const totalCount = pagination.totalCount;

  useEffect(() => {
    setCurrentPage(initialPagination.page);
    setPageSize(initialPagination.pageSize);
    setPriceMin(initialFilters.priceMin ? String(initialFilters.priceMin) : '');
    setPriceMax(initialFilters.priceMax ? String(initialFilters.priceMax) : '');
    setCategoryId(initialFilters.categoryId ? String(initialFilters.categoryId) : 'all');
    setSearchQuery(initialFilters.query ?? '');
  }, [initialPagination, initialFilters]);

  const updateUrl = (next: {
    page?: number;
    pageSize?: number;
    priceMin?: string;
    priceMax?: string;
    categoryId?: string;
  }) => {
    const params = new URLSearchParams();

    const nextPage = next.page ?? currentPage;
    const nextPageSize = next.pageSize ?? pageSize;
    const nextPriceMin = next.priceMin ?? priceMin;
    const nextPriceMax = next.priceMax ?? priceMax;
    const nextCategoryId = next.categoryId ?? categoryId;

    params.set('page', String(nextPage));
    params.set('pageSize', String(nextPageSize));

    if (nextPriceMin.trim()) {
      params.set('priceMin', nextPriceMin.trim());
    }

    if (nextPriceMax.trim()) {
      params.set('priceMax', nextPriceMax.trim());
    }

    if (nextCategoryId && nextCategoryId !== 'all') {
      params.set('categoryId', nextCategoryId);
    }

    if (searchQuery.trim()) {
      params.set('q', searchQuery.trim());
    }

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  useEffect(() => {
    const onRecommendations = (event: Event) => {
      const customEvent = event as CustomEvent<RecommendationEventDetail>;
      const payload = customEvent.detail;
      setIsGeneratingRecommendations(false);
      setHasRecommendationResponse(true);

      if (!payload || !Array.isArray(payload.items)) {
        return;
      }

      setRecommendationSummary(payload.summary || null);
      setRecommendedItems(payload.items);
    };

    const onRecommendationsLoading = () => {
      setIsGeneratingRecommendations(true);
      setRecommendationSummary(null);
      setRecommendedItems([]);
      setHasRecommendationResponse(false);
    };

    const onRecommendationsError = () => {
      setIsGeneratingRecommendations(false);
      setHasRecommendationResponse(false);
    };

    window.addEventListener('buysmart:recommendations', onRecommendations);
    window.addEventListener('buysmart:recommendations:loading', onRecommendationsLoading);
    window.addEventListener('buysmart:recommendations:error', onRecommendationsError);

    return () => {
      window.removeEventListener('buysmart:recommendations', onRecommendations);
      window.removeEventListener('buysmart:recommendations:loading', onRecommendationsLoading);
      window.removeEventListener('buysmart:recommendations:error', onRecommendationsError);
    };
  }, []);

  // Active filter display
  const activeFilters = useMemo(() => {
    const filters = [];
    if (searchQuery.trim()) {
      filters.push(`Search: ${searchQuery.trim()}`);
    }
    if (priceMin || priceMax) {
      const minLabel = formatFilterValue(priceMin, formatCurrency(0));
      const maxLabel = formatFilterValue(priceMax, 'BDT max');
      filters.push(`Price: ${minLabel} - ${maxLabel}`);
    }
    const selectedCategory = categories.find((c) => c.category_id.toString() === categoryId);
    if (selectedCategory && categoryId !== 'all') {
      filters.push(`Category: ${selectedCategory.name}`);
    }
    return filters;
  }, [searchQuery, priceMin, priceMax, categoryId, categories]);

  const handleClearFilters = () => {
    setPriceMin('');
    setPriceMax('');
    setCategoryId('all');
    setCurrentPage(1);
    updateUrl({
      page: 1,
      priceMin: '',
      priceMax: '',
      categoryId: 'all',
    });
  };

  const displayProducts = useMemo(() => {
    if (!recommendedItems.length) {
      return products;
    }

    const priorityMap = new Map<string, number>(
      recommendedItems.map((item, index) => [item.productId, index]),
    );

    return [...products].sort((a, b) => {
      const aRank = priorityMap.get(a.product_id);
      const bRank = priorityMap.get(b.product_id);

      if (aRank === undefined && bRank === undefined) return 0;
      if (aRank === undefined) return 1;
      if (bRank === undefined) return -1;
      return aRank - bRank;
    });
  }, [products, recommendedItems]);

  const recommendedCardItems = useMemo<RecommendedCardItem[]>(() => {
    if (!recommendedItems.length) {
      return [];
    }

    const productsById = new Map(products.map((product) => [product.product_id, product]));

    return recommendedItems.map((item) => {
      const product = productsById.get(item.productId);

      return {
        ...item,
        image: product?.image,
        name: product?.name ?? item.title,
        productPrice: product?.price ?? item.price,
      };
    });
  }, [products, recommendedItems]);

  return (
    <div className="space-y-6">
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
                    onBlur={() => {
                      setCurrentPage(1);
                      updateUrl({ page: 1, priceMin });
                    }}
                    className="text-sm"
                  />
                  <Input
                    type="number"
                    placeholder="Max price"
                    value={priceMax}
                    onChange={(e) => setPriceMax(e.target.value)}
                    onBlur={() => {
                      setCurrentPage(1);
                      updateUrl({ page: 1, priceMax });
                    }}
                    className="text-sm"
                  />
                </div>
              </div>

              <Separator />

              {/* Category Filter */}
              <div className="space-y-3">
                <Label className="font-semibold">Category</Label>
                <Select
                  value={categoryId}
                  onValueChange={(value) => {
                    setCategoryId(value);
                    setCurrentPage(1);
                    updateUrl({ page: 1, categoryId: value });
                  }}
                >
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

              <Button
                variant="default"
                size="sm"
                className="w-full"
                onClick={() => {
                  setCurrentPage(1);
                  updateUrl({ page: 1, priceMin, priceMax, categoryId });
                }}
                disabled={isPending}
              >
                Apply filters
              </Button>

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
          <ProductSearchInput initialValue={searchQuery} debounceMs={350} />

          {isGeneratingRecommendations ? (
            <Card className="relative overflow-hidden border-primary/20 bg-background/50 shadow-lg shadow-primary/10">
              <div className="absolute inset-0 bg-linear-to-r from-red-500/15 via-purple-500/15 to-amber-500/15 bg-size-[200%_200%] animate-magical-gradient" />
              <CardHeader className="pb-3 text-center relative z-10">
                <CardTitle className="text-lg flex items-center justify-center gap-2 bg-linear-to-r from-red-500 via-purple-500 to-amber-500 bg-clip-text text-transparent font-bold drop-shadow-sm">
                  <Sparkles className="h-5 w-5 text-purple-500 animate-pulse" />
                  Curating Your Magical Matches...
                </CardTitle>
                <div className="text-sm text-muted-foreground mt-2 font-medium">
                  Analyzing your intent and exploring our catalog for the perfect fit...
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Card
                      key={i}
                      className="relative overflow-hidden border-border/40 bg-card/60 backdrop-blur-sm"
                    >
                      {/* Shimmer effect */}
                      <div className="pointer-events-none absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-zinc-400/10 dark:via-zinc-100/10 to-transparent animate-shimmer" />
                      <div className="aspect-video bg-muted/40" />
                      <CardContent className="space-y-3 p-3">
                        <div className="h-4 w-3/4 bg-muted/60 rounded" />
                        <div className="space-y-2">
                          <div className="h-3 w-full bg-muted/60 rounded" />
                          <div className="h-3 w-5/6 bg-muted/60 rounded" />
                        </div>
                        <div className="h-4 w-1/4 bg-muted/60 rounded mt-2" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : recommendedCardItems.length > 0 ? (
            <Card className="border-primary/20 bg-primary/5 shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2 text-primary font-semibold">
                  <Sparkles className="h-5 w-5" />
                  Handpicked For You
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {recommendationSummary ? (
                  <div className="relative rounded-lg bg-background/50 p-4 border border-primary/10">
                    <p className="text-sm leading-relaxed text-foreground/80 italic">
                      &quot;{recommendationSummary}&quot;
                    </p>
                  </div>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {recommendedCardItems.map((item) => {
                    const confidence = Math.round(Math.max(0, Math.min(1, item.score)) * 100);
                    let confidenceColor = 'bg-primary/90 text-primary-foreground';
                    if (confidence > 85) confidenceColor = 'bg-emerald-500 text-white';
                    else if (confidence < 50) confidenceColor = 'bg-amber-500 text-white';

                    return (
                      <Link
                        key={`${item.productId}-${item.title}`}
                        href={`/buyer/products/${item.productId}`}
                        className="group block"
                      >
                        <Card className="h-full overflow-hidden border-border/60 transition-all duration-300 hover:shadow-xl hover:border-primary/40 hover:-translate-y-1">
                          <div className="relative aspect-4/3 w-full overflow-hidden bg-muted/30">
                            {item.image ? (
                              <Image
                                src={item.image}
                                alt={item.name}
                                fill
                                className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                                No image
                              </div>
                            )}

                            {/* Gradient Overlay for legibility */}
                            <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                            {/* Confidence Badge */}
                            <div className="absolute right-2 top-2 z-10">
                              <Badge
                                className={`px-2 py-0.5 text-xs font-bold shadow-sm ${confidenceColor} border-none`}
                              >
                                {confidence}% Match
                              </Badge>
                            </div>
                          </div>

                          <CardContent className="space-y-2.5 p-4 flex flex-col justify-between">
                            <div>
                              <h3 className="line-clamp-1 text-base font-semibold group-hover:text-primary transition-colors">
                                {item.name}
                              </h3>
                              <p className="line-clamp-2 text-sm text-muted-foreground mt-1.5 leading-relaxed">
                                {item.reason}
                              </p>
                            </div>
                            {item.productPrice !== undefined ? (
                              <div className="pt-2 flex items-center justify-between">
                                <span className="text-base font-bold text-foreground">
                                  {formatCurrency(item.productPrice)}
                                </span>
                                <span className="text-xs font-medium text-primary flex items-center gap-1 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                                  View Details &rarr;
                                </span>
                              </div>
                            ) : null}
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : hasRecommendationResponse ? (
            <Card className="border-dashed border-muted-foreground/30 bg-muted/30">
              <CardContent className="py-10 text-center space-y-4">
                <div className="mx-auto flex h-28 w-28 items-center justify-center">
                  <Image
                    src="/icons/salesperson_sorry.png"
                    alt="Salesperson apologizing"
                    width={112}
                    height={112}
                    className="h-28 w-28 object-contain"
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">
                    Sorry! I could not find a matching product.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {recommendationSummary ??
                      'Try a different intent or loosen your constraints and I will keep looking.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}

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
              <Select
                value={pageSize.toString()}
                onValueChange={(v) => {
                  const nextPageSize = parseInt(v, 10);
                  setPageSize(nextPageSize);
                  setCurrentPage(1);
                  updateUrl({ page: 1, pageSize: nextPageSize });
                }}
              >
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
                <Badge key={filter} variant="secondary">
                  {filter}
                </Badge>
              ))}
            </div>
          )}

          {/* Products Grid/List */}
          {isPending ? (
            <div className="flex items-center justify-center py-12">
              <div className="space-y-2 text-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary mx-auto" />
                <p className="text-sm text-muted-foreground">Loading products...</p>
              </div>
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/50 p-12 text-center">
              <p className="text-muted-foreground">
                No products found matching your filters
                {searchQuery.trim() ? ' and search terms' : ''}.
              </p>
              {activeFilters.length > 0 && (
                <Button variant="link" size="sm" className="mt-2" onClick={handleClearFilters}>
                  Try clearing filters
                </Button>
              )}
            </div>
          ) : (
            <div
              className={
                viewMode === 'grid' ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3' : 'space-y-3'
              }
            >
              {displayProducts.map((product) => (
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
                  onClick={() => {
                    const nextPage = Math.max(1, currentPage - 1);
                    setCurrentPage(nextPage);
                    updateUrl({ page: nextPage });
                  }}
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
                        onClick={() => {
                          setCurrentPage(pageNum);
                          updateUrl({ page: pageNum });
                        }}
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
                  onClick={() => {
                    const nextPage = Math.min(totalPages, currentPage + 1);
                    setCurrentPage(nextPage);
                    updateUrl({ page: nextPage });
                  }}
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
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md bg-muted">
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
                  {formatCurrency(product.price)}
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
            <div className="mt-3 text-lg font-bold text-primary">
              {formatCurrency(product.price)}
            </div>
          </CardContent>
        </Card>
      )}
    </Link>
  );
}
