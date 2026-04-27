import { createClient } from '@/lib/supabase/server';
import { getServiceRoleSupabase } from '@/lib/supabase/service-role';
import type { Database, Json } from '@/lib/types/database.types';
import type {
  CreateFeedbackInput,
  Feedback,
  FeedbackListFilters,
  FeedbackViewerScope,
  UpdateFeedbackInput,
  UserRole,
} from '@/lib/models/feedback.model';
import type { FeedbackSentimentPersistenceInput } from '@/lib/types/feedback-sentiment.types';

type FeedbackInsert = Database['public']['Tables']['feedback']['Insert'];
type FeedbackUpdate = Database['public']['Tables']['feedback']['Update'];

export interface FeedbackInsightsFilters {
  sellerId?: string;
  fromDateIso?: string;
}

export interface FeedbackInsightsRecord {
  feedback_id: string;
  title: string | null;
  comment: string | null;
  created_at: string;
  product_id: string | null;
  product_name: string | null;
  buyer_user_id: string | null;
  buyer_full_name: string | null;
  buyer_display_name: string | null;
  buyer_avatar_url: string | null;
  ai_sentiment: Database['public']['Enums']['ai_sentiment_enum'];
  ai_confidence_score: number | null;
}

export async function fetchUserRole(userId: string): Promise<UserRole | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('users_profile')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data?.role as UserRole | undefined) ?? null;
}

export async function fetchFeedbackById(feedbackId: string): Promise<Feedback | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('feedback')
    .select('*')
    .eq('feedback_id', feedbackId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as Feedback | null) ?? null;
}

export async function fetchSellerOwnedProductIds(sellerId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .select('product_id')
    .eq('seller_id', sellerId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => row.product_id);
}

export async function isSellerOwnerOfProduct(
  sellerId: string,
  productId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from('products')
    .select('product_id', { count: 'exact', head: true })
    .eq('product_id', productId)
    .eq('seller_id', sellerId);

  if (error) {
    throw new Error(error.message);
  }

  return (count ?? 0) > 0;
}

export async function fetchBuyerOrderById(
  buyerId: string,
  orderId: string,
): Promise<{ order_id: string; status: string } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('orders')
    .select('order_id, status')
    .eq('order_id', orderId)
    .eq('buyer_id', buyerId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return {
    order_id: data.order_id,
    status: data.status,
  };
}

export async function fetchBuyerOrderItemById(
  buyerId: string,
  orderItemId: string,
): Promise<{
  order_item_id: string;
  order_id: string;
  product_id: string;
  status: string;
  order_status: string;
} | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('order_items')
    .select('order_item_id, order_id, product_id, status, orders!inner(buyer_id, status)')
    .eq('order_item_id', orderItemId)
    .eq('orders.buyer_id', buyerId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return {
    order_item_id: data.order_item_id,
    order_id: data.order_id,
    product_id: data.product_id,
    status: data.status,
    order_status: (() => {
      const ordersData = (data as { orders?: { status?: string } | { status?: string }[] }).orders;
      const status = Array.isArray(ordersData) ? ordersData[0]?.status : ordersData?.status;
      return status ?? '';
    })(),
  };
}

export async function fetchLatestDeliveredOrderItemForBuyerProduct(
  buyerId: string,
  productId: string,
  orderId?: string,
): Promise<{ order_id: string; order_item_id: string } | null> {
  const supabase = await createClient();

  let query = supabase
    .from('order_items')
    .select('order_item_id, order_id, orders!inner(buyer_id, status)')
    .eq('orders.buyer_id', buyerId)
    .eq('product_id', productId)
    .eq('status', 'delivered')
    .in('orders.status', ['delivered', 'completed'])
    .order('created_at', { ascending: false })
    .limit(1);

  if (orderId) {
    query = query.eq('order_id', orderId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return {
    order_id: data.order_id,
    order_item_id: data.order_item_id,
  };
}

export async function fetchFeedbackListForScope(
  filters: FeedbackListFilters,
  scope: FeedbackViewerScope,
): Promise<{ feedback: Feedback[]; totalCount: number }> {
  const supabase = await createClient();
  const role = scope.role;
  let scoped = supabase.from('feedback').select('*', { count: 'exact' });

  if (role === 'seller') {
    const productIds = await fetchSellerOwnedProductIds(scope.userId);

    if (productIds.length === 0) {
      return { feedback: [], totalCount: 0 };
    }

    scoped = scoped.in('product_id', productIds);
  }

  if (role === 'buyer') {
    scoped = scoped.or(`status.eq.published,user_id.eq.${scope.userId}`);
  }

  if (filters.productId) {
    scoped = scoped.eq('product_id', filters.productId);
  }

  if (filters.orderId) {
    scoped = scoped.eq('order_id', filters.orderId);
  }

  if (filters.userId) {
    scoped = scoped.eq('user_id', filters.userId);
  }

  if (filters.status) {
    scoped = scoped.eq('status', filters.status);
  }

  if (filters.feedbackType) {
    scoped = scoped.eq('feedback_type', filters.feedbackType);
  }

  if (filters.ratingMin !== undefined) {
    scoped = scoped.gte('rating', filters.ratingMin);
  }

  if (filters.ratingMax !== undefined) {
    scoped = scoped.lte('rating', filters.ratingMax);
  }

  switch (filters.sortBy) {
    case 'oldest':
      scoped = scoped.order('created_at', { ascending: true });
      break;
    case 'rating-high':
      scoped = scoped.order('rating', { ascending: false, nullsFirst: false });
      break;
    case 'rating-low':
      scoped = scoped.order('rating', { ascending: true, nullsFirst: false });
      break;
    case 'helpful':
      scoped = scoped.order('is_helpful', { ascending: false });
      break;
    case 'recent':
    default:
      scoped = scoped.order('created_at', { ascending: false });
      break;
  }

  const offset = (filters.page - 1) * filters.pageSize;
  const { data, count, error } = await scoped.range(offset, offset + filters.pageSize - 1);

  if (error) {
    throw new Error(error.message);
  }

  return {
    feedback: (data ?? []) as Feedback[],
    totalCount: count ?? 0,
  };
}

export async function createFeedback(
  userId: string,
  input: CreateFeedbackInput,
): Promise<Feedback> {
  const supabase = await createClient();

  const payload: FeedbackInsert = {
    user_id: userId,
    feedback_type: input.feedback_type,
    product_id: input.product_id ?? null,
    order_id: input.order_id ?? null,
    order_item_id: input.order_item_id ?? null,
    rating: input.rating ?? null,
    title: input.title ?? null,
    comment: input.comment ?? null,
    images: (input.images ?? null) as Json | null,
    is_verified_purchase: input.is_verified_purchase ?? false,
    status: input.status ?? 'published',
  };

  const { data, error } = await supabase.from('feedback').insert(payload).select('*').single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Feedback;
}

export async function updateFeedbackById(
  feedbackId: string,
  input: UpdateFeedbackInput,
): Promise<Feedback> {
  const supabase = await createClient();

  const payload: FeedbackUpdate = {
    updated_at: new Date().toISOString(),
  };

  if (input.feedback_type !== undefined) {
    payload.feedback_type = input.feedback_type;
  }

  if (input.product_id !== undefined) {
    payload.product_id = input.product_id;
  }

  if (input.order_id !== undefined) {
    payload.order_id = input.order_id;
  }

  if (input.order_item_id !== undefined) {
    payload.order_item_id = input.order_item_id;
  }

  if (input.rating !== undefined) {
    payload.rating = input.rating;
  }

  if (input.title !== undefined) {
    payload.title = input.title;
  }

  if (input.comment !== undefined) {
    payload.comment = input.comment;
  }

  if (input.images !== undefined) {
    payload.images = input.images;
  }

  if (input.status !== undefined) {
    payload.status = input.status;
  }

  const { data, error } = await supabase
    .from('feedback')
    .update(payload)
    .eq('feedback_id', feedbackId)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Feedback;
}

export async function softDeleteFeedbackById(
  feedbackId: string,
  moderatorId?: string,
): Promise<Feedback> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('feedback')
    .update({
      status: 'archived',
      moderator_id: moderatorId ?? null,
      moderated_at: moderatorId ? now : null,
      updated_at: now,
    })
    .eq('feedback_id', feedbackId)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Feedback;
}

export async function fetchFeedbackPendingSentimentAnalysis(limit = 20): Promise<Feedback[]> {
  const supabase = await createClient();
  const normalizedLimit = Math.max(1, Math.min(100, Math.trunc(limit)));

  const { data, error } = await supabase
    .from('feedback')
    .select('*')
    .is('ai_processed_at', null)
    .eq('status', 'published')
    .or('comment.not.is.null,title.not.is.null')
    .order('created_at', { ascending: true })
    .limit(normalizedLimit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Feedback[];
}

export async function updateFeedbackSentimentAnalysisById(
  feedbackId: string,
  input: FeedbackSentimentPersistenceInput,
): Promise<Feedback> {
  const serviceRole = getServiceRoleSupabase();
  const supabase = serviceRole ?? (await createClient());

  const payload: FeedbackUpdate = {
    ai_sentiment: input.ai_sentiment,
    ai_confidence_score: input.ai_confidence_score,
    ai_category: input.ai_category,
    ai_urgency: input.ai_urgency,
    ai_keywords: input.ai_keywords,
    ai_processed_at: input.ai_processed_at,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('feedback')
    .update(payload)
    .eq('feedback_id', feedbackId)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Feedback;
}

export async function countPublishedFeedbackForInsights(
  filters: FeedbackInsightsFilters,
): Promise<number> {
  const supabase = await createClient();

  let sellerProductIds: string[] | null = null;
  if (filters.sellerId) {
    sellerProductIds = await fetchSellerOwnedProductIds(filters.sellerId);

    if (sellerProductIds.length === 0) {
      return 0;
    }
  }

  let query = supabase
    .from('feedback')
    .select('feedback_id', { count: 'exact', head: true })
    .eq('status', 'published');

  if (sellerProductIds) {
    query = query.in('product_id', sellerProductIds);
  }

  if (filters.fromDateIso) {
    query = query.gte('created_at', filters.fromDateIso);
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export async function fetchProcessedFeedbackForInsights(
  filters: FeedbackInsightsFilters,
): Promise<FeedbackInsightsRecord[]> {
  const supabase = await createClient();

  let sellerProductIds: string[] | null = null;
  if (filters.sellerId) {
    sellerProductIds = await fetchSellerOwnedProductIds(filters.sellerId);

    if (sellerProductIds.length === 0) {
      return [];
    }
  }

  let query = supabase
    .from('feedback')
    .select(
      'feedback_id, title, comment, created_at, ai_sentiment, ai_confidence_score, product_id, user_id, products(name), users_profile!feedback_user_id_fkey(user_id, full_name, display_name, avatar_url)',
    )
    .eq('status', 'published')
    .not('ai_sentiment', 'is', null)
    .not('ai_processed_at', 'is', null)
    .order('created_at', { ascending: true });

  if (sellerProductIds) {
    query = query.in('product_id', sellerProductIds);
  }

  if (filters.fromDateIso) {
    query = query.gte('created_at', filters.fromDateIso);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (
    (data ?? []) as Array<
      Omit<
        FeedbackInsightsRecord,
        | 'ai_sentiment'
        | 'product_name'
        | 'buyer_user_id'
        | 'buyer_full_name'
        | 'buyer_display_name'
        | 'buyer_avatar_url'
      > & {
        ai_sentiment: Database['public']['Enums']['ai_sentiment_enum'] | null;
        user_id: string | null;
        products?: { name?: string | null } | Array<{ name?: string | null }> | null;
        users_profile?:
          | {
              user_id?: string | null;
              full_name?: string | null;
              display_name?: string | null;
              avatar_url?: string | null;
            }
          | Array<{
              user_id?: string | null;
              full_name?: string | null;
              display_name?: string | null;
              avatar_url?: string | null;
            }>
          | null;
      }
    >
  )
    .filter(
      (
        row,
      ): row is Omit<
        FeedbackInsightsRecord,
        | 'ai_sentiment'
        | 'product_name'
        | 'buyer_user_id'
        | 'buyer_full_name'
        | 'buyer_display_name'
        | 'buyer_avatar_url'
      > & {
        ai_sentiment: Database['public']['Enums']['ai_sentiment_enum'];
        user_id: string | null;
        products?: { name?: string | null } | Array<{ name?: string | null }> | null;
        users_profile?:
          | {
              user_id?: string | null;
              full_name?: string | null;
              display_name?: string | null;
              avatar_url?: string | null;
            }
          | Array<{
              user_id?: string | null;
              full_name?: string | null;
              display_name?: string | null;
              avatar_url?: string | null;
            }>
          | null;
      } => row.ai_sentiment !== null,
    )
    .map((row) => {
      const productData = Array.isArray(row.products) ? row.products[0] : row.products;
      const buyerData = Array.isArray(row.users_profile) ? row.users_profile[0] : row.users_profile;

      return {
        ...row,
        ai_sentiment: row.ai_sentiment,
        product_name: productData?.name ?? null,
        buyer_user_id: buyerData?.user_id ?? row.user_id ?? null,
        buyer_full_name: buyerData?.full_name ?? null,
        buyer_display_name: buyerData?.display_name ?? null,
        buyer_avatar_url: buyerData?.avatar_url ?? null,
      };
    });
}
