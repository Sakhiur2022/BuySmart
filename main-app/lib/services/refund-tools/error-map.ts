import type { BuyerIntentError, BuyerIntentErrorCode } from '@/lib/chatbot/buyer-intent/errors';
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
import { RefundSubmitCommandError } from '@/lib/services/refund-tools/refund-submit-command-builder';
import type { RefundToolErrorDetails } from '@/lib/services/refund-tools/types';

const INFRASTRUCTURE_CODES = new Set([
  'REFUND_API_UNAVAILABLE',
  'REFUND_TIMEOUT',
  'REFUND_DATA_ERROR',
]);

function toMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isTimeoutMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('timeout') ||
    normalized.includes('timed out') ||
    normalized.includes('etimedout') ||
    normalized.includes('econnreset') ||
    normalized.includes('econnrefused') ||
    normalized.includes('network')
  );
}

function buildError(
  code: BuyerIntentErrorCode,
  message: string,
  details: RefundToolErrorDetails,
): BuyerIntentError {
  return {
    code,
    message,
    details,
  };
}

export function mapRefundToolError(error: unknown): BuyerIntentError {
  const message = toMessage(error);

  if (error instanceof RefundSubmitCommandError) {
    return buildError('REFUND_VALIDATION_ERROR', error.message, {
      kind: 'validation',
      retriable: false,
      mascotTrigger: false,
    });
  }

  if (error instanceof RefundIneligibleStatusError) {
    return buildError(error.code, error.message, {
      kind: 'business',
      retriable: false,
      mascotTrigger: false,
    });
  }

  if (error instanceof RefundIneligiblePaymentStatusError) {
    return buildError(error.code, error.message, {
      kind: 'business',
      retriable: false,
      mascotTrigger: false,
    });
  }

  if (error instanceof RefundInvalidAmountError) {
    return buildError(error.code as BuyerIntentErrorCode, error.message, {
      kind: 'business',
      retriable: false,
      mascotTrigger: false,
    });
  }

  if (error instanceof RefundConflictError) {
    return buildError(error.code as BuyerIntentErrorCode, error.message, {
      kind: 'business',
      retriable: false,
      mascotTrigger: false,
    });
  }

  if (error instanceof RefundForeignKeyError || error instanceof RefundConstraintError) {
    return buildError(error.code as BuyerIntentErrorCode, error.message, {
      kind: 'validation',
      retriable: false,
      mascotTrigger: false,
    });
  }

  if (error instanceof RefundRepositoryError) {
    return buildError('REFUND_DATA_ERROR', error.message, {
      kind: 'infrastructure',
      retriable: true,
      mascotTrigger: true,
    });
  }

  if (message === 'UNAUTHENTICATED') {
    return buildError('UNAUTHENTICATED', 'Sign in to continue with the refund request.', {
      kind: 'validation',
      retriable: false,
      mascotTrigger: false,
    });
  }

  if (message === 'FORBIDDEN') {
    return buildError('FORBIDDEN', 'You do not have permission to request this refund.', {
      kind: 'validation',
      retriable: false,
      mascotTrigger: false,
    });
  }

  if (message === 'Order not found') {
    return buildError('ORDER_NOT_FOUND', 'We could not find that order.', {
      kind: 'business',
      retriable: false,
      mascotTrigger: false,
    });
  }

  if (message === 'Refund not found') {
    return buildError('REFUND_NOT_FOUND', 'We could not find that refund request.', {
      kind: 'business',
      retriable: false,
      mascotTrigger: false,
    });
  }

  if (isTimeoutMessage(message)) {
    return buildError('REFUND_TIMEOUT', 'Refund service is taking too long to respond.', {
      kind: 'infrastructure',
      retriable: true,
      mascotTrigger: true,
    });
  }

  return buildError('UNKNOWN_ERROR', 'Something went wrong while handling the refund.', {
    kind: 'unknown',
    retriable: false,
    mascotTrigger: false,
  });
}

export function isRetriableRefundToolError(error: unknown): boolean {
  const mapped = mapRefundToolError(error);
  const details = mapped.details as RefundToolErrorDetails | undefined;
  if (!details) {
    return false;
  }

  if (details.retriable) {
    return true;
  }

  return INFRASTRUCTURE_CODES.has(mapped.code);
}
