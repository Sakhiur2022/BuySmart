import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/app/api/cart/_shared';
import { formatRefundErrorResponse, logRefundRouteError } from '@/app/api/refunds/_shared';
import {
  createRefundDTOSchema,
  refundFilterDTOSchema,
  type RefundFilterDTO,
} from '@/lib/types/refund.types';
import { createRefund, listRefunds } from '@/lib/controllers/refund.controller';

function toFilterQuery(request: NextRequest): Record<string, string | undefined> {
  const searchParams = request.nextUrl.searchParams;

  return {
    page: searchParams.get('page') || undefined,
    pageSize: searchParams.get('pageSize') || undefined,
    status: searchParams.get('status') || undefined,
    reason_code: searchParams.get('reason_code') || undefined,
    refund_type: searchParams.get('refund_type') || undefined,
    order_id: searchParams.get('order_id') || undefined,
    order_item_id: searchParams.get('order_item_id') || undefined,
    processed_by: searchParams.get('processed_by') || undefined,
    dateFrom: searchParams.get('dateFrom') || undefined,
    dateTo: searchParams.get('dateTo') || undefined,
    sortBy: searchParams.get('sortBy') || undefined,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuthenticatedUser();
    const parsed = refundFilterDTOSchema.safeParse(toFilterQuery(request));

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const filters: RefundFilterDTO = parsed.data;
    const result = await listRefunds(userId, filters);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    logRefundRouteError('GET /api/refunds', error);
    const { status, body } = formatRefundErrorResponse(error);
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

    const parsed = createRefundDTOSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const refund = await createRefund(userId, parsed.data);
    return NextResponse.json({ refund }, { status: 201 });
  } catch (error) {
    logRefundRouteError('POST /api/refunds', error);
    const { status, body } = formatRefundErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
