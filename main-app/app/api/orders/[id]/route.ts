import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthenticatedUser } from '@/app/api/cart/_shared';
import { getBuyerOrderById } from '@/lib/services/order.service';

const orderIdParamsSchema = z.object({
  id: z.string().uuid(),
});

function formatOrderErrorResponse(error: unknown): {
  status: number;
  body: { error: string };
} {
  if (error instanceof Error) {
    if (error.message === 'UNAUTHENTICATED') {
      return { status: 401, body: { error: 'Unauthorized: Not authenticated' } };
    }

    if (error.message === 'FORBIDDEN') {
      return { status: 403, body: { error: 'Forbidden: Only buyers can access orders' } };
    }

    if (error.message === 'Order not found') {
      return { status: 404, body: { error: 'Order not found' } };
    }

    if (
      error.message.includes('required') ||
      error.message.includes('Invalid') ||
      error.message.includes('must')
    ) {
      return { status: 400, body: { error: error.message } };
    }
  }

  return { status: 500, body: { error: 'Internal server error' } };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const parsedParams = orderIdParamsSchema.safeParse(resolvedParams);

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
    const detail = await getBuyerOrderById(userId, parsedParams.data.id);

    return NextResponse.json(detail, { status: 200 });
  } catch (error) {
    const { status, body } = formatOrderErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
