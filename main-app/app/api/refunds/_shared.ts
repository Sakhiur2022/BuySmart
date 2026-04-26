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

export function logRefundRouteError(context: string, error: unknown): void {
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

export function formatRefundErrorResponse(error: unknown): {
  status: number;
  body: { error: string; code?: string };
} {
  const errorLike = toErrorLike(error);
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
  }

  return {
    status: 500,
    body: {
      error: 'Internal server error',
      code: errorCode,
    },
  };
}
