import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceRoleSupabase } from '@/lib/supabase/service-role';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface ReviewStats {
  average_rating: number;
  total_reviews: number;
  rating_distribution: {
    [key: string]: number;
  };
}

function getImageUrl(entry: unknown): string | undefined {
  if (typeof entry === 'string' && entry.trim().length > 0) {
    return entry;
  }

  if (entry && typeof entry === 'object') {
    const record = entry as Record<string, unknown>;
    const url =
      (typeof record.url === 'string' && record.url) ||
      (typeof record.src === 'string' && record.src) ||
      (typeof record.path === 'string' && record.path) ||
      undefined;

    return url && url.trim().length > 0 ? url : undefined;
  }

  return undefined;
}

function getImageList(images: unknown): string[] {
  if (!Array.isArray(images)) {
    return [];
  }

  return images
    .map((entry) => getImageUrl(entry))
    .filter((entry): entry is string => typeof entry === 'string');
}

async function resolveCategory(
  categoryId: number,
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ category_id: number; name: string } | null> {
  const { data: categoryData, error: categoryError } = await supabase
    .from('categories')
    .select('category_id, name')
    .eq('category_id', categoryId)
    .maybeSingle();

  if (!categoryError && categoryData) {
    return {
      category_id: categoryData.category_id,
      name: categoryData.name,
    };
  }

  if (categoryError) {
    console.error('Category fetch error:', categoryError);
  }

  const serviceRole = getServiceRoleSupabase();

  if (!serviceRole) {
    return null;
  }

  const { data: fallbackCategory, error: fallbackError } = await serviceRole
    .from('categories')
    .select('category_id, name')
    .eq('category_id', categoryId)
    .maybeSingle();

  if (fallbackError) {
    console.error('Category fallback fetch error:', fallbackError);
    return null;
  }

  if (!fallbackCategory) {
    return null;
  }

  return {
    category_id: fallbackCategory.category_id,
    name: fallbackCategory.name,
  };
}

// ============================================================================
// REQUEST HANDLER
// ============================================================================

/**
 * GET /api/products/[id]
 * Fetch detailed product information including seller and review statistics
 *
 * Response:
 * {
 *   product: {...},
 *   reviews: {
 *     average_rating: number,
 *     total_reviews: number,
 *     rating_distribution: {...}
 *   },
 *   relatedProducts: [...]
 * }
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Fetch base product record first. Keep this query simple so missing
    // foreign key relationships do not cause false "not found" responses.
    const { data: product, error: productError } = await supabase
      .from('products')
      .select(
        `
        product_id,
        name,
        price,
        description,
        short_description,
        images,
        category_id,
        status,
        seller_id,
        created_at
        `,
      )
      .eq('product_id', id)
      .eq('status', 'active')
      .single();

    if (productError || !product) {
      console.error('Product fetch error:', productError);
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Fetch optional category info separately to avoid hard dependency on
    // Supabase relation metadata in the main product query.
    let category: { category_id: number; name: string } | null = null;
    const hasCategoryId = product.category_id !== null && product.category_id !== undefined;

    if (hasCategoryId) {
      category = await resolveCategory(product.category_id as number, supabase);
    }

    // Fetch seller info
    const { data: seller, error: sellerError } = await supabase
      .from('users_profile')
      .select('user_id, full_name, display_name, avatar_url')
      .eq('user_id', product.seller_id)
      .maybeSingle();

    if (sellerError) {
      console.error('Seller fetch error:', sellerError);
    }

    // If profile names are empty, try auth metadata as a secondary source.
    let sellerNameFromAuth: string | null = null;
    if (!seller?.full_name?.trim() && !seller?.display_name?.trim()) {
      const serviceRole = getServiceRoleSupabase();
      if (serviceRole) {
        const { data: authUserData, error: authUserError } =
          await serviceRole.auth.admin.getUserById(product.seller_id);

        if (authUserError) {
          console.error('Seller auth metadata fetch error:', authUserError);
        } else {
          const metadata = authUserData.user?.user_metadata ?? {};
          const fullName = typeof metadata.full_name === 'string' ? metadata.full_name.trim() : '';
          const name = typeof metadata.name === 'string' ? metadata.name.trim() : '';
          sellerNameFromAuth = fullName || name || null;
        }
      }
    }

    // Fetch review statistics
    const { data: reviews, error: reviewsError } = await supabase
      .from('feedback')
      .select('rating')
      .eq('product_id', id)
      .in('status', ['published']);

    const reviewStats: ReviewStats = {
      average_rating: 0,
      total_reviews: 0,
      rating_distribution: {
        5: 0,
        4: 0,
        3: 0,
        2: 0,
        1: 0,
      },
    };

    if (!reviewsError && reviews && reviews.length > 0) {
      const ratings = (reviews as { rating: number | null }[])
        .map((r) => r.rating)
        .filter((r) => r !== null) as number[];

      if (ratings.length > 0) {
        const sum = ratings.reduce((a, b) => a + b, 0);
        reviewStats.average_rating = Math.round((sum / ratings.length) * 10) / 10;
        reviewStats.total_reviews = ratings.length;

        // Calculate distribution
        ratings.forEach((rating) => {
          const star = Math.round(rating);
          if (star >= 1 && star <= 5) {
            reviewStats.rating_distribution[star]++;
          }
        });
      }
    }

    // Fetch related products (same category)
    let relatedProducts: Array<{
      product_id: string;
      name: string;
      price: number;
      image?: string;
      short_description: string | null;
    }> = [];
    if (hasCategoryId) {
      const { data: related, error: relatedError } = await supabase
        .from('products')
        .select('product_id, name, price, images, short_description')
        .eq('category_id', product.category_id as number)
        .eq('status', 'active')
        .neq('product_id', id)
        .limit(5);

      if (!relatedError && related) {
        relatedProducts = related.map((p) => ({
          product_id: p.product_id,
          name: p.name,
          price: p.price,
          image:
            Array.isArray(p.images) && p.images.length > 0 ? getImageUrl(p.images[0]) : undefined,
          short_description: p.short_description,
        }));
      }
    }

    // Format response
    const formattedProduct = {
      product_id: product.product_id,
      name: product.name,
      price: product.price,
      description: product.description,
      short_description: product.short_description,
      images: getImageList(product.images),
      category,
      seller: seller
        ? {
            user_id: seller.user_id,
            full_name:
              seller.full_name?.trim() ||
              seller.display_name?.trim() ||
              sellerNameFromAuth ||
              `Seller ${seller.user_id.slice(0, 8)}`,
            avatar_url: seller.avatar_url,
          }
        : null,
      status: product.status,
      created_at: product.created_at,
    };

    return NextResponse.json(
      {
        product: formattedProduct,
        reviews: reviewStats,
        relatedProducts,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Error fetching product detail:', error);
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}
