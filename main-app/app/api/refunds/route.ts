import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/app/api/cart/_shared';
import {
  createRefundDTOSchema,
  refundFilterDTOSchema,
  type RefundFilterDTO,
} from '@/lib/types/refund.types';
import { createRefund, listRefunds } from '@/lib/controllers/refund.controller';
import {
  RefundIneligibleStatusError,
  RefundInvalidAmountError,
} from '@/lib/services/refund.service';

function formatRefundErrorResponse(error: unknown): {
  status: number;
  body: { error: string; code?: string };
} {
  if (error instanceof Error) {
    if (error.message === 'UNAUTHENTICATED') {
      return { status: 401, body: { error: 'Unauthorized: Not authenticated' } };
    }

    if (error.message === 'FORBIDDEN') {
      return { status: 403, body: { error: 'Forbidden: Insufficient permissions' } };
    }

    if (error.message === 'Order not found' || error.message === 'Refund not found') {
      return { status: 404, body: { error: error.message } };
    }

    if (error instanceof RefundIneligibleStatusError) {
      return {
        status: 422,
        body: {
          error: error.message,
          code: error.code,
        },
      };
    }

    if (error instanceof RefundInvalidAmountError) {
      return {
        status: 400,
        body: {
          error: error.message,
          code: error.code,
        },
      };
    }

    if (error.message.includes('duplicate key value')) {
      return { status: 409, body: { error: 'Refund already exists for this order context' } };
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

function toFilterQuery(request: NextRequest): Record<string, string | undefined> {
  const searchParams = request.nextUrl.searchParams;

  return {
    page: searchParams.get('page') || undefined,
    pageSize: searchParams.get('pageSize') || undefined,
    status: searchParams.get('status') || undefined,
    reason_code: searchParams.get('reason_code') || undefined,
    refund_type: searchParams.get('refund_type') || undefined,
    buyer_id: searchParams.get('buyer_id') || undefined,
    seller_id: searchParams.get('seller_id') || undefined,
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
    const { status, body } = formatRefundErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
