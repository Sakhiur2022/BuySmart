'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Star, Heart, Share2, Check, ShoppingCart, MessageSquare, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

// ============================================================================
// TYPES
// ============================================================================

interface ProductData {
  product: {
    product_id: string;
    name: string;
    price: number;
    description: string | null;
    short_description: string | null;
    images: string[];
    category?: {
      category_id: number;
      name: string;
    } | null;
    seller?: {
      user_id: string;
      full_name: string;
      avatar_url: string | null;
    } | null;
    status: string;
    created_at: string;
  };
  reviews: {
    average_rating: number;
    total_reviews: number;
    rating_distribution: { [key: string]: number };
  };
  relatedProducts: Array<{
    product_id: string;
    name: string;
    price: number;
    image?: string;
    short_description: string | null;
  }>;
}

interface ProductDetailComponentProps {
  productData: ProductData;
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function RatingStars({ rating, size = 'default' }: { rating: number; size?: 'sm' | 'default' }) {
  const sizeClass = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${sizeClass} ${
            star <= Math.round(rating)
              ? 'fill-yellow-400 text-yellow-400'
              : 'text-zinc-300 dark:text-zinc-600'
          }`}
        />
      ))}
    </div>
  );
}

function RatingDistribution({ distribution }: { distribution: { [key: string]: number } }) {
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-2">
      {[5, 4, 3, 2, 1].map((rating) => {
        const count = distribution[rating] || 0;
        const percentage = total > 0 ? (count / total) * 100 : 0;

        return (
          <div key={rating} className="flex items-center gap-2">
            <span className="text-sm font-medium w-12">{rating} star</span>
            <div className="flex-1 h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-400 transition-all"
                style={{ width: `${percentage}%` }}
              />
            </div>
            <span className="text-sm text-zinc-600 dark:text-zinc-400 w-8 text-right">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface RecommendedItem {
  productId: string;
  title: string;
  reason: string;
  score: number;
  price?: number;
  image?: string;
}

interface RecommendationEventDetail {
  summary: string;
  items: RecommendedItem[];
}

export default function ProductDetailComponent({ productData }: ProductDetailComponentProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isWishlisted, setIsWishlisted] = useState(false);

  // AI Recommendation State
  const [isGeneratingRecommendations, setIsGeneratingRecommendations] = useState(false);
  const [recommendedItems, setRecommendedItems] = useState<RecommendedItem[]>([]);
  const [recommendationSummary, setRecommendationSummary] = useState<string | null>(null);
  const [hasRecommendationResponse, setHasRecommendationResponse] = useState(false);

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

  const { product, reviews, relatedProducts } = productData;
  const selectedImage = product.images[selectedImageIndex];

  // Merge image data for recommendations
  const recommendedCardItems = useMemo(() => {
    if (!recommendedItems.length) return [];

    const productsById = new Map();
    // Use the main product if it's recommended
    productsById.set(product.product_id, {
      image: product.images?.[0],
      name: product.name,
      price: product.price,
    });
    // Use related products
    relatedProducts.forEach((p) => {
      productsById.set(p.product_id, { image: p.image, name: p.name, price: p.price });
    });

    return recommendedItems.map((item) => {
      const match = productsById.get(item.productId);
      return {
        ...item,
        image: match?.image ?? item.image,
        name: match?.name ?? item.title,
        productPrice: match?.price ?? item.price,
      };
    });
  }, [recommendedItems, product, relatedProducts]);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="mb-8 flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <Link href="/buyer?mode=buyer" className="hover:text-zinc-900 dark:hover:text-zinc-200">
          Home
        </Link>
        {product.category && (
          <>
            <span>/</span>
            <Link
              href={`/buyer?mode=buyer&categoryId=${product.category.category_id}`}
              className="hover:text-zinc-900 dark:hover:text-zinc-200"
            >
              {product.category.name}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-zinc-900 dark:text-zinc-200">{product.name}</span>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column: Images */}
        <div className="lg:col-span-1">
          <div className="sticky top-4 space-y-4">
            {/* Main Image */}
            <div className="relative aspect-square overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
              {selectedImage ? (
                <Image
                  src={selectedImage}
                  alt={product.name}
                  fill
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="flex h-full items-center justify-center text-zinc-400">
                  No image available
                </div>
              )}
            </div>

            {/* Thumbnail Gallery */}
            {product.images.length > 1 && (
              <div className="flex gap-2">
                {product.images.map((image, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`relative aspect-square h-16 overflow-hidden rounded-lg border-2 transition-all ${
                      idx === selectedImageIndex
                        ? 'border-emerald-600'
                        : 'border-zinc-200 dark:border-zinc-700'
                    }`}
                  >
                    <Image
                      src={image}
                      alt={`${product.name} ${idx + 1}`}
                      fill
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Middle Column: Product Info */}
        <div className="lg:col-span-1">
          <div className="space-y-6">
            {/* Product Title & Category */}
            <div className="space-y-2">
              {product.category && (
                <Link
                  href={`/buyer?mode=buyer&categoryId=${product.category.category_id}`}
                  className="inline-block"
                >
                  <Badge variant="secondary">{product.category.name}</Badge>
                </Link>
              )}
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">{product.name}</h1>
            </div>

            {/* Rating */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <RatingStars rating={reviews.average_rating} />
                <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {reviews.average_rating.toFixed(1)}
                </span>
              </div>
              <Separator orientation="vertical" className="h-6" />
              <Link
                href="#reviews"
                className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                {reviews.total_reviews} reviews
              </Link>
            </div>

            {/* Price */}
            <div className="space-y-2">
              <div className="text-4xl font-bold text-emerald-600">${product.price.toFixed(2)}</div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Free shipping on orders over $50
              </p>
            </div>

            {/* Description */}
            {product.short_description && (
              <p className="text-zinc-700 dark:text-zinc-300">{product.short_description}</p>
            )}

            <Separator />

            {/* Quantity & Add to Cart */}
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">Quantity:</span>
                <div className="flex items-center border border-zinc-300 dark:border-zinc-600 rounded-lg">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-12 text-center border-x border-zinc-300 dark:border-zinc-600 bg-transparent"
                  />
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    +
                  </button>
                </div>
              </div>

              <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 text-base">
                <ShoppingCart className="mr-2 h-5 w-5" />
                Add to Cart
              </Button>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setIsWishlisted(!isWishlisted)}
                  className="flex-1"
                >
                  <Heart className={`h-5 w-5 ${isWishlisted ? 'fill-red-500 text-red-500' : ''}`} />
                </Button>
                <Button variant="outline" size="icon" className="flex-1">
                  <Share2 className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Seller & More Info */}
        <div className="lg:col-span-1 space-y-6">
          {/* Seller Card */}
          {product.seller && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sold by</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  {product.seller.avatar_url ? (
                    <div className="relative h-12 w-12 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                      <Image
                        src={product.seller.avatar_url}
                        alt={product.seller.full_name}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                  )}
                  <div>
                    <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-50">
                      {product.seller.full_name}
                    </p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">Verified Seller</p>
                  </div>
                </div>

                <Button variant="outline" className="w-full">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Contact Seller
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Product Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Product Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Free shipping on orders over $50</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>30-day returns</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>1-year warranty</span>
              </div>
            </CardContent>
          </Card>

          {/* Rating Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Customer Ratings</CardTitle>
            </CardHeader>
            <CardContent>
              <RatingDistribution distribution={reviews.rating_distribution} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Full Description Section */}
      {product.description && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose dark:prose-invert max-w-none">
              <p className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                {product.description}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Recommendation Section */}
      {isGeneratingRecommendations ? (
        <div className="mt-8 space-y-4">
          <Card className="relative overflow-hidden border-primary/20 bg-background/50 shadow-lg shadow-primary/10">
            <div className="absolute inset-0 bg-linear-to-r from-red-500/15 via-purple-500/15 to-amber-500/15 bg-size-[200%_200%] animate-magical-gradient" />
            <CardHeader className="pb-3 text-center relative z-10">
              <CardTitle className="text-2xl flex items-center justify-center gap-2 bg-linear-to-r from-red-500 via-purple-500 to-amber-500 bg-clip-text text-transparent font-bold drop-shadow-sm">
                <Sparkles className="h-6 w-6 text-purple-500 animate-pulse" />
                Curating Your Magical Matches...
              </CardTitle>
              <div className="text-sm text-muted-foreground mt-2 font-medium">
                Analyzing your intent and exploring our catalog for the perfect fit...
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Card
                    key={i}
                    className="relative overflow-hidden border-border/40 bg-card/60 h-full backdrop-blur-sm"
                  >
                    {/* Shimmer effect */}
                    <div className="pointer-events-none absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-zinc-400/10 dark:via-zinc-100/10 to-transparent animate-shimmer" />
                    <div className="aspect-square bg-muted/40" />
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
        </div>
      ) : recommendedCardItems.length > 0 ? (
        <div className="mt-8 space-y-4">
          <Card className="border-primary/20 bg-primary/5 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-2xl flex items-center gap-2 text-primary font-bold">
                <Sparkles className="h-6 w-6" />
                Handpicked For You
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {recommendationSummary && (
                <div className="relative rounded-lg bg-background/50 p-4 border border-primary/10">
                  <p className="text-sm leading-relaxed text-foreground/80 italic">
                    &quot;{recommendationSummary}&quot;
                  </p>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
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
                        <div className="relative aspect-square w-full overflow-hidden bg-muted/30">
                          {item.image ? (
                            <Image
                              src={item.image}
                              alt={item.name}
                              fill
                              className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs text-muted-foreground p-4 text-center">
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
                            <h3 className="line-clamp-1 text-sm font-semibold group-hover:text-primary transition-colors">
                              {item.name}
                            </h3>
                            <p className="line-clamp-2 text-xs text-muted-foreground mt-1.5 leading-relaxed">
                              {item.reason}
                            </p>
                          </div>
                          {item.productPrice !== undefined ? (
                            <div className="pt-2 flex items-center justify-between">
                              <span className="text-sm font-bold text-foreground">
                                ${item.productPrice.toFixed(2)}
                              </span>
                              <span className="text-xs font-medium text-primary flex items-center gap-1 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                                View &rarr;
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
        </div>
      ) : hasRecommendationResponse ? (
        <div className="mt-8">
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
        </div>
      ) : null}

      {/* Related Products */}
      {relatedProducts.length > 0 &&
        !isGeneratingRecommendations &&
        recommendedCardItems.length === 0 && (
          <div className="mt-8 space-y-4">
            <h2 className="text-2xl font-bold">Related Products</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {relatedProducts.map((relatedProduct) => (
                <Link
                  key={relatedProduct.product_id}
                  href={`/buyer/products/${relatedProduct.product_id}`}
                >
                  <Card className="group overflow-hidden transition-all hover:shadow-lg h-full">
                    <div className="relative aspect-square overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                      {relatedProduct.image ? (
                        <Image
                          src={relatedProduct.image}
                          alt={relatedProduct.name}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-zinc-400">
                          No image
                        </div>
                      )}
                    </div>
                    <CardContent className="p-3">
                      <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-emerald-600 transition-colors">
                        {relatedProduct.name}
                      </h3>
                      <p className="mt-2 font-bold text-emerald-600">
                        ${relatedProduct.price.toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
    </div>
  );
}
