import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthenticatedUser } from '@/app/api/cart/_shared';
import { analyzeFeedbackSentiment } from '@/lib/controllers/feedback.controller';

const feedbackIdParamsSchema = z.object({
  id: z.string().uuid(),
});

function describeAnalysisFailureCategory(errorMessage: string): string {
  const [, category = 'provider'] = errorMessage.split(':', 3);

  switch (category) {
    case 'timeout':
      return 'timeout';
    case 'rate_limit':
      return 'rate limit';
    case 'configuration':
      return 'configuration';
    case 'response':
      return 'response parsing';
    case 'request':
      return 'request';
    case 'provider':
    default:
      return 'provider';
  }
}

function formatFeedbackSentimentErrorResponse(error: unknown): {
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

    if (error.message.startsWith('AI_ANALYSIS_FAILED:')) {
      const category = describeAnalysisFailureCategory(error.message);
      return {
        status: 502,
        body: {
          error: `Sentiment analysis provider failed (${category}). Please retry shortly.`,
        },
      };
    }

    if (error.message.includes('required') || error.message.includes('Invalid')) {
      return { status: 400, body: { error: error.message } };
    }
  }

  return { status: 500, body: { error: 'Internal server error' } };
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    const result = await analyzeFeedbackSentiment(userId, parsedParams.data.id);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const { status, body } = formatFeedbackSentimentErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
