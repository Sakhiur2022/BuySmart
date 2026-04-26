import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthenticatedUser } from '@/app/api/cart/_shared';
import { formatRefundErrorResponse, logRefundRouteError } from '@/app/api/refunds/_shared';
import { rejectRefundDecisionDTOSchema } from '@/lib/types/refund.types';
import { rejectRefund } from '@/lib/controllers/refund.controller';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const parsedParams = paramsSchema.safeParse(await params);

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

    const parsedPayload = rejectRefundDecisionDTOSchema.safeParse(payload);
    if (!parsedPayload.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: parsedPayload.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { userId } = await requireAuthenticatedUser();
    const refund = await rejectRefund(userId, parsedParams.data.id, parsedPayload.data);

    return NextResponse.json({ refund }, { status: 200 });
  } catch (error) {
    logRefundRouteError('POST /api/refunds/[id]/reject', error);
    const { status, body } = formatRefundErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
