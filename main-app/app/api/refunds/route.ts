import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/app/api/cart/_shared';
import {
  createRefundDTOSchema,
  refundFilterDTOSchema,
  type RefundFilterDTO,
} from '@/lib/types/refund.types';
import { createRefund, listRefunds } from '@/lib/controllers/refund.controller';
import {
  RefundConflictError,
  RefundConstraintError,
  RefundForeignKeyError,
  RefundRepositoryError,
} from '@/lib/repositories/refund.repository';
import {
  RefundIneligiblePaymentStatusError,
  RefundIneligibleStatusError,
  RefundInvalidAmountError,
} from '@/lib/services/refund.service';

type SerializableErrorLike = {
  message?: unknown;
  code?: unknown;
  details?: unknown;
  hint?: unknown;
  stack?: unknown;
};

function toErrorLike(error: unknown): SerializableErrorLike {
  if (typeof error === 'object' && error !== null) {
    return error as SerializableErrorLike;
  }

  return {};
}

function logRefundRouteError(context: 'GET /api/refunds' | 'POST /api/refunds', error: unknown): void {
  const errorLike = toErrorLike(error);
  const name = error instanceof Error ? error.name : 'UnknownError';
  const message =
    error instanceof Error
      ? error.message
      : typeof errorLike.message === 'string'
        ? errorLike.message
        : String(error);
  const code = typeof errorLike.code === 'string' ? errorLike.code : undefined;
  const details = typeof errorLike.details === 'string' ? errorLike.details : undefined;
  const hint = typeof errorLike.hint === 'string' ? errorLike.hint : undefined;

  console.error('[refunds-route] request failed', {
    context,
    name,
    code,
    message,
    details,
    hint,
    stack: error instanceof Error ? error.stack : undefined,
  });
}

function formatRefundErrorResponse(error: unknown): {
  status: number;
  body: { error: string; code?: string };
} {
  const errorLike = toErrorLike(error);
  const fallbackMessage =
    typeof errorLike.message === 'string' && errorLike.message.trim().length > 0
      ? errorLike.message
      : 'Internal server error';
  const errorCode = typeof errorLike.code === 'string' ? errorLike.code : undefined;

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

    if (error instanceof RefundIneligiblePaymentStatusError) {
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

    if (error instanceof RefundConflictError) {
      return {
        status: 409,
        body: {
          error: error.message,
          code: error.code,
        },
      };
    }

    if (error instanceof RefundForeignKeyError || error instanceof RefundConstraintError) {
      return {
        status: 400,
        body: {
          error: error.message,
          code: error.code,
        },
      };
    }

    if (error instanceof RefundRepositoryError) {
      return {
        status: 500,
        body: {
          error: error.message || 'Refund repository error',
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

  return {
    status: 500,
    body: {
      error: fallbackMessage,
      code: errorCode,
    },
  };
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
