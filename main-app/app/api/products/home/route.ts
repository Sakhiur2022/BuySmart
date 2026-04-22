import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceRoleSupabase } from '@/lib/supabase/service-role';

interface ProductRow {
  product_id: string;
  name: string;
  category_id: number | null;
  price: number;
  tags: unknown;
  images: unknown;
  created_at: string | null;
}

interface OrderItemMetricRow {
  product_id: string;
  quantity: number | null;
}

interface FeedbackMetricRow {
  product_id: string | null;
  rating: number | null;
}

const MAX_HOME_PRODUCTS = 100;
const PRODUCT_IMAGE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_PRODUCT_IMAGE_BUCKET?.trim() || 'product-images';

function getImageCandidate(images: unknown): string | undefined {
  if (!images) {
    return undefined;
  }

  if (typeof images === 'string') {
    const trimmed = images.trim();
    if (!trimmed) {
      return undefined;
    }

    if (
      (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
      (trimmed.startsWith('{') && trimmed.endsWith('}'))
    ) {
      try {
        return getImageCandidate(JSON.parse(trimmed));
      } catch {
        return trimmed;
      }
    }

    return trimmed;
  }

  if (Array.isArray(images) && images.length > 0) {
    return getImageCandidate(images[0]);
  }

  if (images && typeof images === 'object') {
    const imageRecord = images as Record<string, unknown>;
    const keys = ['url', 'src', 'path', 'publicUrl', 'public_url'];

    for (const key of keys) {
      const candidate = imageRecord[key];
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }
  }

  return undefined;
}

function toDisplayImageUrl(rawUrl: string | undefined): string | undefined {
  if (!rawUrl) {
    return undefined;
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return undefined;
  }

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed;
  }

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  if (!baseUrl) {
    return undefined;
  }

  const normalizedPath = trimmed.replace(/^\/+/, '');
  return `${baseUrl}/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/${normalizedPath}`;
}

async function fetchActiveProducts() {
  const supabase = await createClient();
  const serviceRole = getServiceRoleSupabase();

  const queryBuilder = (client: typeof supabase) =>
    client
      .from('products')
      .select('product_id, name, category_id, price, tags, images, created_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(MAX_HOME_PRODUCTS);

  let productsResult = await queryBuilder(supabase);

  if ((productsResult.error || (productsResult.data ?? []).length === 0) && serviceRole) {
    productsResult = await queryBuilder(serviceRole);
  }

  return { supabase, serviceRole, productsResult };
}

async function fetchOrderItemMetrics(
  productIds: string[],
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const serviceRole = getServiceRoleSupabase();

  const queryBuilder = (client: typeof supabase) =>
    client
      .from('order_items')
      .select('product_id, quantity')
      .in('product_id', productIds)
      .in('status', ['confirmed', 'shipped', 'delivered']);

  let result = await queryBuilder(supabase);

  if ((result.error || (result.data ?? []).length === 0) && serviceRole) {
    result = await queryBuilder(serviceRole);
  }

  return result;
}

async function fetchFeedbackMetrics(
  productIds: string[],
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const serviceRole = getServiceRoleSupabase();

  const queryBuilder = (client: typeof supabase) =>
    client
      .from('feedback')
      .select('product_id, rating')
      .eq('status', 'published')
      .in('product_id', productIds)
      .not('rating', 'is', null);

  let result = await queryBuilder(supabase);

  if ((result.error || (result.data ?? []).length === 0) && serviceRole) {
    result = await queryBuilder(serviceRole);
  }

  return result;
}

export async function GET() {
  try {
    const { supabase, productsResult } = await fetchActiveProducts();

    if (productsResult.error) {
      console.error('Failed to load home products:', productsResult.error);
      return NextResponse.json({ error: 'Failed to fetch home products' }, { status: 500 });
    }

    const products = (productsResult.data ?? []) as ProductRow[];

    if (products.length === 0) {
      return NextResponse.json({ products: [] }, { status: 200 });
    }

    const productIds = products.map((product) => product.product_id);
    const [orderItemsResult, feedbackResult] = await Promise.all([
      fetchOrderItemMetrics(productIds, supabase),
      fetchFeedbackMetrics(productIds, supabase),
    ]);

    const salesByProduct = new Map<string, number>();
    (orderItemsResult.data as OrderItemMetricRow[] | null)?.forEach((row) => {
      const quantity = row.quantity ?? 0;
      salesByProduct.set(row.product_id, (salesByProduct.get(row.product_id) ?? 0) + quantity);
    });

    const ratingAccumulator = new Map<string, { total: number; count: number }>();
    (feedbackResult.data as FeedbackMetricRow[] | null)?.forEach((row) => {
      if (!row.product_id || row.rating === null) {
        return;
      }

      const existing = ratingAccumulator.get(row.product_id) ?? { total: 0, count: 0 };
      ratingAccumulator.set(row.product_id, {
        total: existing.total + row.rating,
        count: existing.count + 1,
      });
    });

    const mappedProducts = products.map((product) => {
      const ratingAggregate = ratingAccumulator.get(product.product_id);
      const averageRating =
        ratingAggregate && ratingAggregate.count > 0
          ? Math.round((ratingAggregate.total / ratingAggregate.count) * 10) / 10
          : 0;

      return {
        id: product.product_id,
        title: product.name,
        category_id: product.category_id ?? undefined,
        price: product.price,
        image: toDisplayImageUrl(getImageCandidate(product.images)),
        tags: product.tags ?? undefined,
        created_at: product.created_at ?? undefined,
        sales_count: salesByProduct.get(product.product_id) ?? 0,
        average_rating: averageRating,
      };
    });

    return NextResponse.json({ products: mappedProducts }, { status: 200 });
  } catch (error) {
    console.error('Error fetching home products:', error);
    return NextResponse.json({ error: 'Failed to fetch home products' }, { status: 500 });
  }
}
