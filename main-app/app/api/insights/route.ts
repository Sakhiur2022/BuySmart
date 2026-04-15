import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/app/api/cart/_shared';
import {
  feedbackInsightsResponseSchema,
  insightsQuerySchema,
} from '@/lib/types/insights.types';
import { getFeedbackInsightsForUser } from '@/lib/services/insights.service';

function formatInsightsErrorResponse(error: unknown): {
  status: number;
  body: { error: string };
} {
  if (error instanceof Error) {
    if (error.message === 'UNAUTHENTICATED') {
      return { status: 401, body: { error: 'Unauthorized: Not authenticated' } };
    }

    if (error.message === 'FORBIDDEN') {
      return {
        status: 403,
        body: { error: 'Forbidden: Only sellers or admins can access insights' },
      };
    }

    if (error.message.includes('Invalid')) {
      return { status: 400, body: { error: error.message } };
    }
  }

  return { status: 500, body: { error: 'Internal server error' } };
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuthenticatedUser();

    const queryParams = {
      sellerId: request.nextUrl.searchParams.get('sellerId') || undefined,
      timeframe: request.nextUrl.searchParams.get('timeframe') || undefined,
    };

    const parsedQuery = insightsQuerySchema.safeParse(queryParams);
    if (!parsedQuery.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: parsedQuery.error.flatten(),
        },
        { status: 400 },
      );
    }

    const responsePayload = await getFeedbackInsightsForUser(userId, parsedQuery.data);
    const validatedResponse = feedbackInsightsResponseSchema.safeParse(responsePayload);

    if (!validatedResponse.success) {
      console.error('Insights response validation failed:', validatedResponse.error.flatten());
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json(validatedResponse.data, { status: 200 });
  } catch (error) {
    const { status, body } = formatInsightsErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
