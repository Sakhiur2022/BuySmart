import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

// ============================================================================
// TYPE DEFINITIONS & CONSTANTS
// ============================================================================

interface ReviewRecord {
  feedback_id: string;
  rating: number | null;
  title: string | null;
  comment: string | null;
  created_at: string;
  verified_purchase: boolean;
  status: string;
  user_id: string;
  ai_sentiment: string | null;
  ai_confidence_score: number | null;
  users_profile?: Array<{
    user_id: string;
    full_name: string | null;
    avatar_url: string | null;
  }> | {
    user_id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const SORT_OPTIONS = ['recent', 'helpful', 'rating-high', 'rating-low'] as const;

// ============================================================================
// ZOD SCHEMA
// ============================================================================

const reviewsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_LIMIT).optional().default(DEFAULT_LIMIT),
  sortBy: z.enum(SORT_OPTIONS).optional().default('recent'),
});

// ============================================================================
// REQUEST HANDLER
// ============================================================================

/**
 * GET /api/products/[id]/reviews
 * Fetch paginated product reviews with sorting options
 *
 * Query parameters:
 * - page: number (default: 1)
 * - pageSize: 1-50 (default: 10)
 * - sortBy: 'recent' | 'helpful' | 'rating-high' | 'rating-low' (default: 'recent')
 *
 * Response:
 * {
 *   reviews: [
 *     {
 *       feedback_id: string,
 *       rating: number,
 *       content: string,
 *       created_at: string,
 *       verified_purchase: boolean,
 *       user?: { user_id, full_name, avatar_url }
 *     }
 *   ],
 *   pagination: {
 *     page: number,
 *     pageSize: number,
 *     totalCount: number,
 *     totalPages: number
 *   }
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

    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryParams = {
      page: searchParams.get('page') || undefined,
      pageSize: searchParams.get('pageSize') || undefined,
      sortBy: searchParams.get('sortBy') || undefined,
    };

    const parsed = reviewsQuerySchema.safeParse(queryParams);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { page, pageSize, sortBy } = parsed.data;

    const supabase = await createClient();

    // Build base query
    let query = supabase
      .from('feedback')
      .select(
        `
        feedback_id,
        rating,
        title,
        comment,
        created_at,
        verified_purchase,
        status,
        user_id,
        ai_sentiment,
        ai_confidence_score,
        users_profile!inner(user_id, full_name, avatar_url)
        `,
        { count: 'exact' }
      )
      .eq('product_id', id)
      .in('status', ['approved', 'verified']);

    // Apply sorting
    switch (sortBy) {
      case 'helpful':
        query = query.order('helpful_count', { ascending: false });
        break;
      case 'rating-high':
        query = query.order('rating', { ascending: false });
        break;
      case 'rating-low':
        query = query.order('rating', { ascending: true });
        break;
      case 'recent':
      default:
        query = query.order('created_at', { ascending: false });
        break;
    }

    // Apply pagination
    const offset = (page - 1) * pageSize;
    query = query.range(offset, offset + pageSize - 1);

    const { data: reviews, count, error } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch reviews' },
        { status: 500 }
      );
    }

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / pageSize);

    // Format reviews with user info
    const formattedReviews = (reviews || []).map((review: ReviewRecord) => {
      const userArray = Array.isArray(review.users_profile)
        ? review.users_profile
        : (review.users_profile ? [review.users_profile] : []);

      return {
        feedback_id: review.feedback_id,
        rating: review.rating || 0,
        title: review.title || null,
        content: review.comment || '',
        created_at: review.created_at,
        verified_purchase: review.verified_purchase || false,
        ai_sentiment: review.ai_sentiment || null,
        ai_confidence_score:
          typeof review.ai_confidence_score === 'number' ? review.ai_confidence_score : null,
        user: userArray.length > 0
          ? {
              user_id: userArray[0].user_id,
              full_name: userArray[0].full_name || 'Anonymous',
              avatar_url: userArray[0].avatar_url,
            }
          : {
              user_id: review.user_id,
              full_name: 'Anonymous',
              avatar_url: null,
            },
      };
    });

    return NextResponse.json(
      {
        reviews: formattedReviews,
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching product reviews:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}
