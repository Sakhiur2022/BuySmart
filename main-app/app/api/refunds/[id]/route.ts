import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthenticatedUser } from '@/app/api/cart/_shared';
import { formatRefundErrorResponse, logRefundRouteError } from '@/app/api/refunds/_shared';
import { getRefundById } from '@/lib/controllers/refund.controller';

const refundIdParamsSchema = z.object({
  id: z.string().uuid(),
});

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
    logRefundRouteError('GET /api/refunds/[id]', error);
    const { status, body } = formatRefundErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
