'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { Star, Heart, Share2, Check, ShoppingCart, MessageSquare, Sparkles, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency } from '@/lib/utils';
import { useCart } from '@/lib/context/cart-context';

type FeedbackTypeOption =
  | 'product_review'
  | 'seller_review'
  | 'service_feedback'
  | 'general_feedback';
type FeedbackStatusOption = 'draft' | 'published';

const FEEDBACK_TYPE_OPTIONS: Array<{ value: FeedbackTypeOption; label: string }> = [
  { value: 'product_review', label: 'Product review' },
  { value: 'seller_review', label: 'Seller review' },
  { value: 'service_feedback', label: 'Service feedback' },
  { value: 'general_feedback', label: 'General feedback' },
];

const FEEDBACK_STATUS_OPTIONS: Array<{ value: FeedbackStatusOption; label: string }> = [
  { value: 'published', label: 'Publish now' },
  { value: 'draft', label: 'Save as draft' },
];

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

type SentimentLabel = 'positive' | 'neutral' | 'negative' | 'mixed';

interface ReviewItem {
  feedback_id: string;
  rating: number;
  title: string | null;
  content: string;
  created_at: string;
  verified_purchase: boolean;
  ai_sentiment: SentimentLabel | null;
  ai_confidence_score: number | null;
  user: {
    user_id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

interface ReviewsApiResponse {
  reviews: ReviewItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
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

function getSentimentBadgeInfo(sentiment: ReviewItem['ai_sentiment']) {
  switch (sentiment) {
    case 'positive':
      return {
        label: 'Positive',
        className:
          'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200',
      };
    case 'negative':
      return {
        label: 'Negative',
        className:
          'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200',
      };
    case 'mixed':
      return {
        label: 'Mixed',
        className:
          'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200',
      };
    case 'neutral':
    default:
      return {
        label: sentiment ? 'Neutral' : 'Pending',
        className:
          'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200',
      };
  }
}

function formatReviewDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown date';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
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

interface FeedbackApiResponse {
  feedback?: {
    feedback_id?: string;
    feedback_type?: string;
    status?: string;
    product_id?: string | null;
    rating?: number | null;
    title?: string | null;
    comment?: string | null;
    images?: unknown;
  };
}

interface FeedbackApiErrorResponse {
  error?: string;
  issues?: {
    fieldErrors?: Record<string, string[] | undefined>;
  };
}


export default function ProductDetailComponent({ productData }: ProductDetailComponentProps) {
  const searchParams = useSearchParams();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const [cartNotice, setCartNotice] = useState<string | null>(null);
  const { addItem, items: cartItems, summary: cartSummary, isLoading: isCartLoading } = useCart();

  // AI Recommendation State
  const [isGeneratingRecommendations, setIsGeneratingRecommendations] = useState(false);
  const [recommendedItems, setRecommendedItems] = useState<RecommendedItem[]>([]);
  const [recommendationSummary, setRecommendationSummary] = useState<string | null>(null);
  const [hasRecommendationResponse, setHasRecommendationResponse] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackTitle, setFeedbackTitle] = useState('');
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackType, setFeedbackType] = useState<FeedbackTypeOption>('product_review');
  const [feedbackStatus, setFeedbackStatus] = useState<FeedbackStatusOption>('published');
  const [feedbackImageInput, setFeedbackImageInput] = useState('');
  const [feedbackImages, setFeedbackImages] = useState<string[]>([]);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [isLoadingFeedbackForEdit, setIsLoadingFeedbackForEdit] = useState(false);
  const [isFeedbackFormOpen, setIsFeedbackFormOpen] = useState(false);
  const [editingFeedbackId, setEditingFeedbackId] = useState<string | null>(null);
  const [submittedFeedbackId, setSubmittedFeedbackId] = useState<string | null>(null);
  const [feedbackNotice, setFeedbackNotice] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [reviewList, setReviewList] = useState<ReviewItem[]>([]);
  const [reviewsPagination, setReviewsPagination] = useState<ReviewsApiResponse['pagination'] | null>(null);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);

  const prefillOrderId = searchParams.get('orderId')?.trim() || undefined;
  const prefillOrderItemId = searchParams.get('orderItemId')?.trim() || undefined;
  const prefillFeedbackId = searchParams.get('feedbackId')?.trim() || undefined;
  const shouldTriggerFeedbackForm = ['1', 'true', 'yes'].includes(
    (searchParams.get('leaveFeedback') || '').toLowerCase(),
  );
  const shouldTriggerEditFeedbackForm =
    ['1', 'true', 'yes'].includes((searchParams.get('editFeedback') || '').toLowerCase()) &&
    Boolean(prefillFeedbackId);

  useEffect(() => {
    if (shouldTriggerFeedbackForm) {
      setIsFeedbackFormOpen(true);
      setFeedbackType('product_review');
      setEditingFeedbackId(null);
    }
  }, [shouldTriggerFeedbackForm]);

  useEffect(() => {
    let active = true;

    async function loadFeedbackForEdit() {
      if (!shouldTriggerEditFeedbackForm || !prefillFeedbackId) {
        return;
      }

      setIsFeedbackFormOpen(true);
      setIsLoadingFeedbackForEdit(true);
      setFeedbackNotice(null);

      try {
        const response = await fetch(`/api/feedback/${prefillFeedbackId}`);
        const payload = (await response.json().catch(() => null)) as FeedbackApiResponse | FeedbackApiErrorResponse | null;

        if (!response.ok) {
          if (!active) {
            return;
          }

          const message =
            (payload as FeedbackApiErrorResponse | null)?.error ||
            'Could not load your existing feedback for editing.';
          setFeedbackNotice({ type: 'error', message });
          return;
        }

        const feedback = (payload as FeedbackApiResponse | null)?.feedback;

        if (!feedback || !feedback.feedback_id) {
          if (!active) {
            return;
          }

          setFeedbackNotice({
            type: 'error',
            message: 'Feedback was not found for editing.',
          });
          return;
        }

        if (feedback.product_id && feedback.product_id !== productData.product.product_id) {
          if (!active) {
            return;
          }

          setFeedbackNotice({
            type: 'error',
            message: 'This feedback belongs to a different product.',
          });
          return;
        }

        if (!active) {
          return;
        }

        setEditingFeedbackId(feedback.feedback_id);
        setFeedbackType(
          feedback.feedback_type === 'seller_review' ||
            feedback.feedback_type === 'service_feedback' ||
            feedback.feedback_type === 'general_feedback'
            ? feedback.feedback_type
            : 'product_review',
        );
        setFeedbackStatus(feedback.status === 'draft' ? 'draft' : 'published');
        setFeedbackRating(
          typeof feedback.rating === 'number' && feedback.rating >= 1 && feedback.rating <= 5
            ? feedback.rating
            : 0,
        );
        setFeedbackTitle(feedback.title ?? '');
        setFeedbackComment(feedback.comment ?? '');
        setFeedbackImages(
          Array.isArray(feedback.images)
            ? feedback.images.filter((image): image is string => typeof image === 'string')
            : [],
        );
      } catch {
        if (active) {
          setFeedbackNotice({
            type: 'error',
            message: 'Network error while loading your feedback. Please retry.',
          });
        }
      } finally {
        if (active) {
          setIsLoadingFeedbackForEdit(false);
        }
      }
    }

    void loadFeedbackForEdit();

    return () => {
      active = false;
    };
  }, [prefillFeedbackId, productData.product.product_id, shouldTriggerEditFeedbackForm]);

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

  const handleAddToCart = async () => {
    if (isAddingToCart || isCartLoading) {
      return;
    }

    setIsAddingToCart(true);
    try {
      await addItem(product.product_id, quantity);
      setCartNotice('Item added to cart!');
      setIsCartDrawerOpen(true);
    } finally {
      setIsAddingToCart(false);
    }
  };

  const cartPreviewItems = useMemo(() => {
    const grouped = new Map<
      string,
      {
        cart_item_id: string;
        product_id: string;
        quantity: number;
        line_total: number;
        product: (typeof cartItems)[number]['product'];
      }
    >();

    for (const item of cartItems) {
      const key = item.product_id;
      const unitPrice = item.product?.price ?? 0;
      const lineTotal = Number.isFinite(item.line_total) ? item.line_total : unitPrice * item.quantity;
      const existing = grouped.get(key);

      if (existing) {
        existing.quantity += item.quantity;
        existing.line_total += lineTotal;
        continue;
      }

      grouped.set(key, {
        cart_item_id: item.cart_item_id,
        product_id: item.product_id,
        quantity: item.quantity,
        line_total: lineTotal,
        product: item.product,
      });
    }

    return Array.from(grouped.values()).slice(0, 4);
  }, [cartItems]);
  const cartSubtotal = useMemo(() => {
    if (Number.isFinite(cartSummary.totalAmount)) {
      return cartSummary.totalAmount;
    }

    return cartItems.reduce((sum, item) => {
      const unitPrice = item.product?.price ?? 0;
      const lineTotal = Number.isFinite(item.line_total) ? item.line_total : unitPrice * item.quantity;
      return sum + lineTotal;
    }, 0);
  }, [cartItems, cartSummary.totalAmount]);

  const cartTotalItems = useMemo(() => {
    if (Number.isFinite(cartSummary.totalItems)) {
      return cartSummary.totalItems;
    }

    return cartItems.reduce((sum, item) => sum + item.quantity, 0);
  }, [cartItems, cartSummary.totalItems]);

  useEffect(() => {
    if (!cartNotice) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCartNotice(null);
    }, 2400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [cartNotice]);

  useEffect(() => {
    if (!product?.product_id) {
      return;
    }

    const controller = new AbortController();
    let active = true;

    async function loadReviews() {
      setIsLoadingReviews(true);
      setReviewsError(null);

      try {
        const response = await fetch(
          `/api/products/${product.product_id}/reviews?page=1&pageSize=6&sortBy=recent`,
          { signal: controller.signal },
        );

        const payload = (await response
          .json()
          .catch(() => null)) as ReviewsApiResponse | { error?: string } | null;

        if (!active) {
          return;
        }

        if (!response.ok || !payload || !('reviews' in payload)) {
          setReviewsError(
            (payload as { error?: string } | null)?.error ||
              'Unable to load reviews right now.',
          );
          setReviewList([]);
          setReviewsPagination(null);
          return;
        }

        setReviewList(payload.reviews || []);
        setReviewsPagination(payload.pagination || null);
      } catch (error) {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) {
          return;
        }

        setReviewsError('Unable to load reviews right now.');
      } finally {
        if (active) {
          setIsLoadingReviews(false);
        }
      }
    }

    void loadReviews();

    return () => {
      active = false;
      controller.abort();
    };
  }, [product?.product_id]);

  const handleAddFeedbackImage = () => {
    const nextUrl = feedbackImageInput.trim();
    if (!nextUrl) {
      return;
    }

    let normalized: string;
    try {
      normalized = new URL(nextUrl).toString();
    } catch {
      setFeedbackNotice({
        type: 'error',
        message: 'Please enter a valid image URL.',
      });
      return;
    }

    if (feedbackImages.includes(normalized)) {
      setFeedbackNotice({
        type: 'error',
        message: 'That image has already been added.',
      });
      return;
    }

    if (feedbackImages.length >= 10) {
      setFeedbackNotice({
        type: 'error',
        message: 'You can add up to 10 images per review.',
      });
      return;
    }

    setFeedbackImages((prev) => [...prev, normalized]);
    setFeedbackImageInput('');
    setFeedbackNotice(null);
  };

  const handleRemoveFeedbackImage = (targetUrl: string) => {
    setFeedbackImages((prev) => prev.filter((url) => url !== targetUrl));
  };

  const handleSubmitFeedback = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (feedbackRating < 1 || feedbackRating > 5) {
      setFeedbackNotice({
        type: 'error',
        message: 'Please choose a rating from 1 to 5 stars.',
      });
      return;
    }

    const trimmedComment = feedbackComment.trim();

    setIsSubmittingFeedback(true);
    setFeedbackNotice(null);

    try {
      const isEditMode = Boolean(editingFeedbackId);
      const response = await fetch(isEditMode ? `/api/feedback/${editingFeedbackId}` : '/api/feedback', {
        method: isEditMode ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          feedback_type: feedbackType,
          product_id: product.product_id,
          order_id: feedbackType === 'product_review' ? prefillOrderId : undefined,
          order_item_id: feedbackType === 'product_review' ? prefillOrderItemId : undefined,
          rating: feedbackRating,
          title: feedbackTitle.trim() || undefined,
          comment: trimmedComment || undefined,
          images: feedbackImages.length > 0 ? feedbackImages : undefined,
          status: feedbackStatus,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as FeedbackApiErrorResponse | null;
        const fieldErrors = payload?.issues?.fieldErrors;
        const fieldErrorMessage = fieldErrors
          ? Object.entries(fieldErrors)
              .filter(([, errors]) => Array.isArray(errors) && errors.length > 0)
              .map(([field, errors]) => `${field}: ${errors?.join(', ')}`)
              .join(' | ')
          : '';

        const fallback =
          response.status === 401
            ? 'Please sign in to submit your review.'
            : response.status === 403
              ? 'You can only submit a review for products you have purchased and received.'
              : response.status === 404
                ? 'Feedback endpoint was not found.'
                : response.status === 409
                  ? 'A feedback entry already exists for this context.'
                  : response.status === 400
                    ? 'Please check your review details and try again.'
                    : 'Could not submit review right now. Please try again.';

        setFeedbackNotice({
          type: 'error',
          message:
            fieldErrorMessage ||
            (payload?.error && payload.error !== 'Validation failed' ? payload.error : '') ||
            fallback,
        });
        return;
      }

      const payload = (await response.json().catch(() => null)) as FeedbackApiResponse | null;
      const feedbackId = payload?.feedback?.feedback_id || editingFeedbackId || null;

      setFeedbackTitle('');
      setFeedbackComment('');
      setFeedbackRating(0);
      setFeedbackType('product_review');
      setFeedbackStatus('published');
      setFeedbackImages([]);
      setFeedbackImageInput('');
      setEditingFeedbackId(feedbackId);
      setSubmittedFeedbackId(feedbackId);
      setIsFeedbackFormOpen(false);
      setFeedbackNotice({
        type: 'success',
        message:
          isEditMode
            ? 'Your feedback has been updated successfully.'
            : feedbackId
              ? `Thanks! Your review has been submitted. Reference: ${feedbackId}`
              : 'Thanks! Your review has been submitted.',
      });
    } catch {
      setFeedbackNotice({
        type: 'error',
        message: 'Network error while submitting your review. Please retry.',
      });
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Dialog open={isCartDrawerOpen} onOpenChange={setIsCartDrawerOpen} modal={false}>
        <DialogContent className="left-auto right-0 top-0 flex h-dvh w-full max-w-md translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-l p-0 sm:max-w-md">
          <DialogHeader className="space-y-0 border-b px-5 py-2">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <ShoppingCart className="h-4 w-4 text-primary" />
              <span>Added to cart</span>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 space-y-2 overflow-y-auto px-5 py-3">
            {cartPreviewItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">Your cart is currently empty.</p>
            ) : (
              cartPreviewItems.map((item) => {
                const productName = item.product?.name ?? 'Unavailable product';
                const imageUrl = item.product?.image?.trim() || null;

                return (
                  <div key={item.cart_item_id} className="flex items-center gap-2.5 rounded-lg border p-2.5">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border bg-muted">
                      {imageUrl ? (
                        <Image src={imageUrl} alt={productName} fill sizes="56px" className="object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                          No image
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 leading-tight">
                      <div className="truncate text-sm font-medium">{productName}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">Qty: {item.quantity}</div>
                    </div>
                    <div className="text-sm font-semibold leading-tight">
                      {formatCurrency(Number.isFinite(item.line_total) ? item.line_total : (item.product?.price ?? 0) * item.quantity)}
                    </div>
                  </div>
                );
              })
            )}

            {cartItems.length > cartPreviewItems.length ? (
              <p className="text-xs text-muted-foreground">
                +{cartItems.length - cartPreviewItems.length} more items in cart
              </p>
            ) : null}
          </div>

          <div className="border-t bg-background px-5 py-4">
            <div className="mb-4 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal ({cartTotalItems} items)</span>
              <span className="font-semibold">{formatCurrency(cartSubtotal)}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setIsCartDrawerOpen(false)}>
                Continue shopping
              </Button>
              <Button asChild className="flex-1 bg-red-500 text-white hover:bg-red-600">
                <Link href="/buyer/cart" onClick={() => setIsCartDrawerOpen(false)}>
                  Go to cart
                </Link>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
              <div className="text-4xl font-bold text-emerald-600">
                {formatCurrency(product.price)}
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Free shipping on orders over {formatCurrency(50)}
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

              <Button
                className="w-full bg-red-600 hover:bg-red-700 text-white h-12 text-base"
                onClick={handleAddToCart}
                disabled={isAddingToCart || isCartLoading}
              >
                <ShoppingCart className="mr-2 h-5 w-5" />
                {isAddingToCart || isCartLoading ? 'Adding...' : 'Add to Cart'}
              </Button>

              {cartNotice ? (
                <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {cartNotice}
                </p>
              ) : null}

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
                <span>Free shipping on orders over {formatCurrency(50)}</span>
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

      <Card className="mt-8 border-red-100/80 bg-gradient-to-b from-white to-red-50/40 dark:from-zinc-900 dark:to-zinc-900" id="reviews">
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-xl">Share Your Feedback</CardTitle>
            <Button
              type="button"
              variant={isFeedbackFormOpen ? 'outline' : 'default'}
              size={isFeedbackFormOpen ? 'icon' : 'default'}
              className={isFeedbackFormOpen ? 'h-9 w-9' : 'bg-red-600 text-white hover:bg-red-700'}
              onClick={() => setIsFeedbackFormOpen((prev) => !prev)}
              aria-label={isFeedbackFormOpen ? 'Close feedback form' : 'Write feedback'}
              title={isFeedbackFormOpen ? 'Close form' : 'Write feedback'}
            >
              {isFeedbackFormOpen ? <X className="h-4 w-4" /> : 'Write feedback'}
            </Button>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Tell other shoppers what stood out, and add photos for extra context.
          </p>
        </CardHeader>
        <CardContent>
          {!isFeedbackFormOpen ? (
            <div className="rounded-xl border border-rose-100 bg-gradient-to-r from-white via-rose-50/70 to-rose-100/60 p-4 dark:border-zinc-700 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-900">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-red-100 p-1.5 dark:bg-red-900/30">
                  <MessageSquare className="h-4 w-4 text-red-600 dark:text-red-300" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                    Share your experience when you are ready.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                      1-5 star rating
                    </span>
                    <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                      Up to 10 images
                    </span>
                    <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                      Draft or publish
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div
            className={`overflow-hidden transition-all duration-500 ease-out ${
              isFeedbackFormOpen
                ? 'mt-4 max-h-[2600px] translate-y-0 opacity-100'
                : 'max-h-0 -translate-y-2 opacity-0 pointer-events-none'
            }`}
          >
            <div className="rounded-xl border border-rose-200/70 bg-gradient-to-b from-rose-50/80 via-white to-rose-100/50 p-5 shadow-sm dark:border-zinc-700 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-900">
              <div className="mx-auto mb-4 h-1.5 w-20 rounded-full bg-red-200 dark:bg-red-900/40" />
              <form onSubmit={handleSubmitFeedback} className="space-y-5">
            {isLoadingFeedbackForEdit ? (
              <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                Loading your feedback...
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="feedback-type">Feedback type</Label>
                <select
                  id="feedback-type"
                  value={feedbackType}
                  onChange={(event) => setFeedbackType(event.target.value as FeedbackTypeOption)}
                  className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-200 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-red-500 dark:focus:ring-red-900/30"
                >
                  {FEEDBACK_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="feedback-status">Submission mode</Label>
                <select
                  id="feedback-status"
                  value={feedbackStatus}
                  onChange={(event) => setFeedbackStatus(event.target.value as FeedbackStatusOption)}
                  className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-200 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-red-500 dark:focus:ring-red-900/30"
                >
                  {FEEDBACK_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Rating</Label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFeedbackRating(star)}
                    className="rounded-md p-1 transition hover:scale-105"
                    aria-label={`Set rating to ${star} stars`}
                  >
                    <Star
                      className={`h-6 w-6 ${
                        star <= feedbackRating ? 'fill-yellow-400 text-yellow-400' : 'text-zinc-300 dark:text-zinc-600'
                      }`}
                    />
                  </button>
                ))}
                <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                  {feedbackRating > 0 ? `${feedbackRating} / 5` : 'Select a rating'}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="feedback-title">Title (optional)</Label>
              <Input
                id="feedback-title"
                value={feedbackTitle}
                onChange={(event) => setFeedbackTitle(event.target.value)}
                maxLength={255}
                placeholder="Quick summary of your experience"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="feedback-comment">Your review</Label>
              <Textarea
                id="feedback-comment"
                value={feedbackComment}
                onChange={(event) => setFeedbackComment(event.target.value)}
                maxLength={5000}
                placeholder="What did you like, dislike, or wish was better?"
                className="min-h-28 resize-y"
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {feedbackComment.trim().length}/5000 characters
              </p>
            </div>

            <div className="space-y-3">
              <Label htmlFor="feedback-image-url">Add image URL (optional)</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="feedback-image-url"
                  type="url"
                  value={feedbackImageInput}
                  onChange={(event) => setFeedbackImageInput(event.target.value)}
                  placeholder="https://images.example.com/review-photo.jpg"
                />
                <Button type="button" variant="outline" onClick={handleAddFeedbackImage}>
                  Add image
                </Button>
              </div>

              {feedbackImages.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {feedbackImages.map((imageUrl) => (
                    <div
                      key={imageUrl}
                      className="rounded-lg border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-700 dark:bg-zinc-950"
                    >
                      <div className="relative aspect-video overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800">
                        <Image
                          src={imageUrl}
                          alt="Feedback image preview"
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover"
                        />
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <p className="line-clamp-1 text-xs text-zinc-600 dark:text-zinc-400">
                          {imageUrl}
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-red-600 hover:text-red-700"
                          onClick={() => handleRemoveFeedbackImage(imageUrl)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Add up to 10 images to make your review more helpful.
                </p>
              )}
            </div>

            {submittedFeedbackId ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Last submitted feedback ID: {submittedFeedbackId}
              </p>
            ) : null}

            {feedbackNotice ? (
              <div
                className={`rounded-md border px-3 py-2 text-sm ${
                  feedbackNotice.type === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300'
                }`}
              >
                {feedbackNotice.message}
              </div>
            ) : null}

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={isSubmittingFeedback || isLoadingFeedbackForEdit}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                {isSubmittingFeedback
                  ? editingFeedbackId
                    ? 'Updating review...'
                    : 'Submitting review...'
                  : editingFeedbackId
                    ? 'Update review'
                    : 'Submit review'}
              </Button>
            </div>
              </form>
            </div>
          </div>

          {feedbackNotice && !isFeedbackFormOpen ? (
            <div
              className={`mt-4 rounded-md border px-3 py-2 text-sm ${
                feedbackNotice.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300'
              }`}
            >
              {feedbackNotice.message}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader className="space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Customer Reviews</CardTitle>
            {reviewsPagination ? (
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {reviewsPagination.totalCount} total reviews
              </span>
            ) : null}
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            AI sentiment badges summarize the tone of each review.
          </p>
        </CardHeader>
        <CardContent>
          {isLoadingReviews ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-20 w-full animate-pulse rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
                />
              ))}
            </div>
          ) : reviewsError ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-200">
              {reviewsError}
            </div>
          ) : reviewList.length === 0 ? (
            <div className="rounded-md border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              No reviews yet. Be the first to share your experience.
            </div>
          ) : (
            <div className="space-y-4">
              {reviewList.map((review) => {
                const badgeInfo = getSentimentBadgeInfo(review.ai_sentiment);
                const confidence =
                  typeof review.ai_confidence_score === 'number'
                    ? Math.round(Math.max(0, Math.min(1, review.ai_confidence_score)) * 100)
                    : null;

                return (
                  <div
                    key={review.feedback_id}
                    className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="relative h-10 w-10 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                          {review.user.avatar_url ? (
                            <Image
                              src={review.user.avatar_url}
                              alt={review.user.full_name}
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-zinc-500">
                              {review.user.full_name.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {review.user.full_name}
                          </p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {formatReviewDate(review.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge className={`border ${badgeInfo.className}`}>{badgeInfo.label}</Badge>
                        {confidence !== null ? (
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">
                            {confidence}% confidence
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <RatingStars rating={review.rating} size="sm" />
                      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                        {review.rating.toFixed(1)} / 5
                      </span>
                      {review.verified_purchase ? (
                        <Badge variant="secondary" className="text-xs">
                          Verified purchase
                        </Badge>
                      ) : null}
                    </div>

                    {review.title ? (
                      <p className="mt-3 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                        {review.title}
                      </p>
                    ) : null}

                    {review.content ? (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                        {review.content}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                        No review text provided.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

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
                                {formatCurrency(item.productPrice)}
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
                        {formatCurrency(relatedProduct.price)}
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
