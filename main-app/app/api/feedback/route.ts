import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthenticatedUser } from '@/app/api/cart/_shared';
import {
  createFeedback as createFeedbackController,
  getFeedbackList,
} from '@/lib/controllers/feedback.controller';
import type { FeedbackSortBy, FeedbackStatus, FeedbackType } from '@/lib/models/feedback.model';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const FEEDBACK_TYPE_VALUES: FeedbackType[] = [
  'product_review',
  'seller_review',
  'service_feedback',
  'general_feedback',
];

const FEEDBACK_STATUS_VALUES: FeedbackStatus[] = [
  'draft',
  'published',
  'hidden',
  'flagged',
  'archived',
];

const FEEDBACK_SORT_VALUES: FeedbackSortBy[] = [
  'recent',
  'oldest',
  'rating-high',
  'rating-low',
  'helpful',
];

const listFeedbackQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional().default(DEFAULT_PAGE_SIZE),
  productId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  status: z.enum(FEEDBACK_STATUS_VALUES).optional(),
  feedbackType: z.enum(FEEDBACK_TYPE_VALUES).optional(),
  ratingMin: z.coerce.number().int().min(1).max(5).optional(),
  ratingMax: z.coerce.number().int().min(1).max(5).optional(),
  sortBy: z.enum(FEEDBACK_SORT_VALUES).optional().default('recent'),
});

const createFeedbackSchema = z.object({
  feedback_type: z.enum(FEEDBACK_TYPE_VALUES),
  product_id: z.string().trim().min(1).optional(),
  order_id: z.string().trim().min(1).optional(),
  order_item_id: z.string().trim().min(1).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  title: z.string().trim().max(255).optional(),
  comment: z.string().trim().max(5000).optional(),
  images: z.array(z.string().url()).max(10).optional(),
  status: z.enum(FEEDBACK_STATUS_VALUES).optional(),
});

function formatFeedbackErrorResponse(error: unknown): {
  status: number;
  body: { error: string };
} {
  if (error instanceof Error) {
    if (error.message === 'UNAUTHENTICATED') {
      return { status: 401, body: { error: 'Unauthorized: Not authenticated' } };
    }

    if (error.message === 'FORBIDDEN') {
      return { status: 403, body: { error: 'Forbidden: Insufficient permissions' } };
    }

    if (error.message === 'VERIFIED_PURCHASE_REQUIRED') {
      return {
        status: 403,
        body: { error: 'Only buyers with a delivered purchase can submit this product review' },
      };
    }

    if (error.message === 'Feedback not found') {
      return { status: 404, body: { error: 'Feedback not found' } };
    }

    if (error.message.includes('duplicate key value')) {
      return {
        status: 409,
        body: { error: 'Feedback already exists for this product/order item combination' },
      };
    }

    if (
      error.message.includes('required') ||
      error.message.includes('Invalid') ||
      error.message.includes('At least one field')
    ) {
      return { status: 400, body: { error: error.message } };
    }
  }

  return { status: 500, body: { error: 'Internal server error' } };
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuthenticatedUser();

    const searchParams = request.nextUrl.searchParams;
    const queryParams = {
      page: searchParams.get('page') || undefined,
      pageSize: searchParams.get('pageSize') || undefined,
      productId: searchParams.get('productId') || undefined,
      orderId: searchParams.get('orderId') || undefined,
      userId: searchParams.get('userId') || undefined,
      status: searchParams.get('status') || undefined,
      feedbackType: searchParams.get('feedbackType') || undefined,
      ratingMin: searchParams.get('ratingMin') || undefined,
      ratingMax: searchParams.get('ratingMax') || undefined,
      sortBy: searchParams.get('sortBy') || undefined,
    };

    const parsed = listFeedbackQuerySchema.safeParse(queryParams);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const result = await getFeedbackList(userId, parsed.data);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const { status, body } = formatFeedbackErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuthenticatedUser();

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const parsed = createFeedbackSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const feedback = await createFeedbackController(userId, parsed.data);
    return NextResponse.json({ feedback }, { status: 201 });
  } catch (error) {
    const { status, body } = formatFeedbackErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
