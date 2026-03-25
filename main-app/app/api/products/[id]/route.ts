import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Fetch product with category info
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
        created_at,
        categories!inner(category_id, name)
        `
      )
      .eq('product_id', id)
      .eq('status', 'active')
      .single();

    if (productError || !product) {
      console.error('Product fetch error:', productError);
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Fetch seller info
    const { data: seller, error: sellerError } = await supabase
      .from('users_profile')
      .select('user_id, full_name, avatar_url')
      .eq('user_id', product.seller_id)
      .single();

    if (sellerError) {
      console.error('Seller fetch error:', sellerError);
    }

    // Fetch review statistics
    const { data: reviews, error: reviewsError } = await supabase
      .from('feedback')
      .select('rating')
      .eq('product_id', id)
      .in('status', ['approved', 'verified']);

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
    if (product.category_id) {
      const { data: related, error: relatedError } = await supabase
        .from('products')
        .select('product_id, name, price, images, short_description')
        .eq('category_id', product.category_id)
        .eq('status', 'active')
        .neq('product_id', id)
        .limit(5);

      if (!relatedError && related) {
        relatedProducts = related.map((p) => ({
          product_id: p.product_id,
          name: p.name,
          price: p.price,
          image:
            Array.isArray(p.images) && p.images.length > 0 && typeof p.images[0] === 'string'
              ? p.images[0]
              : undefined,
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
      images:
        Array.isArray(product.images) && product.images.every((img) => typeof img === 'string')
          ? product.images
          : [],
      category: Array.isArray(product.categories)
        ? product.categories[0]
        : product.categories,
      seller: seller
        ? {
            user_id: seller.user_id,
            full_name: seller.full_name || 'Unknown Seller',
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
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching product detail:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    );
  }
}
