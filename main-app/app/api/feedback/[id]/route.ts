import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthenticatedUser } from '@/app/api/cart/_shared';
import {
  deleteFeedback,
  getFeedbackById,
  updateFeedback,
} from '@/lib/controllers/feedback.controller';
import type { FeedbackStatus, FeedbackType } from '@/lib/models/feedback.model';

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

const feedbackIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const updateFeedbackSchema = z
  .object({
    feedback_type: z.enum(FEEDBACK_TYPE_VALUES).optional(),
    product_id: z.string().uuid().nullable().optional(),
    order_id: z.string().uuid().nullable().optional(),
    order_item_id: z.string().uuid().nullable().optional(),
    rating: z.coerce.number().int().min(1).max(5).nullable().optional(),
    title: z.string().trim().max(255).nullable().optional(),
    comment: z.string().trim().max(5000).nullable().optional(),
    images: z.array(z.string().url()).max(10).nullable().optional(),
    status: z.enum(FEEDBACK_STATUS_VALUES).optional(),
  })
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), {
    message: 'At least one field is required for update',
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

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const parsedParams = feedbackIdParamsSchema.safeParse(resolvedParams);

    if (!parsedParams.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: parsedParams.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { userId } = await requireAuthenticatedUser();
    const feedback = await getFeedbackById(userId, parsedParams.data.id);
    return NextResponse.json({ feedback }, { status: 200 });
  } catch (error) {
    const { status, body } = formatFeedbackErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const parsedParams = feedbackIdParamsSchema.safeParse(resolvedParams);

    if (!parsedParams.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: parsedParams.error.flatten(),
        },
        { status: 400 },
      );
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const parsed = updateFeedbackSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { userId } = await requireAuthenticatedUser();
    const feedback = await updateFeedback(userId, parsedParams.data.id, parsed.data);

    return NextResponse.json({ feedback }, { status: 200 });
  } catch (error) {
    const { status, body } = formatFeedbackErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const resolvedParams = await params;
    const parsedParams = feedbackIdParamsSchema.safeParse(resolvedParams);

    if (!parsedParams.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: parsedParams.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { userId } = await requireAuthenticatedUser();
    const feedback = await deleteFeedback(userId, parsedParams.data.id);

    return NextResponse.json({ feedback }, { status: 200 });
  } catch (error) {
    const { status, body } = formatFeedbackErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
