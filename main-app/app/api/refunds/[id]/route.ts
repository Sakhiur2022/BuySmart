import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthenticatedUser } from '@/app/api/cart/_shared';
import { getRefundById } from '@/lib/controllers/refund.controller';

const refundIdParamsSchema = z.object({
  id: z.string().uuid(),
});

function formatRefundErrorResponse(error: unknown): {
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

    if (error.message === 'Refund not found') {
      return { status: 404, body: { error: 'Refund not found' } };
    }

    if (error.message.includes('required') || error.message.includes('Invalid')) {
      return { status: 400, body: { error: error.message } };
    }
  }

  return { status: 500, body: { error: 'Internal server error' } };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const parsedParams = refundIdParamsSchema.safeParse(resolvedParams);

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
    const refund = await getRefundById(userId, parsedParams.data.id);

    return NextResponse.json({ refund }, { status: 200 });
  } catch (error) {
    const { status, body } = formatRefundErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
