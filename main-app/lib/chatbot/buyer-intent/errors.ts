export type BuyerIntentErrorCode =
  | 'INVALID_JSON'
  | 'MISSING_INTENT'
  | 'UNKNOWN_INTENT'
  | 'SCHEMA_NOT_FOUND'
  | 'INVALID_PAYLOAD'
  | 'STRATEGY_NOT_FOUND'
  | 'ADAPTER_ERROR'
  | 'TOOL_NOT_FOUND'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'ORDER_NOT_FOUND'
  | 'REFUND_NOT_FOUND'
  | 'REFUND_VALIDATION_ERROR'
  | 'REFUND_INELIGIBLE_STATUS'
  | 'REFUND_INELIGIBLE_PAYMENT_STATUS'
  | 'REFUND_INVALID_AMOUNT'
  | 'REFUND_CONFLICT'
  | 'REFUND_TIMEOUT'
  | 'REFUND_API_UNAVAILABLE'
  | 'REFUND_DATA_ERROR'
  | 'UNKNOWN_ERROR';

export type BuyerIntentError = {
  code: BuyerIntentErrorCode;
  message: string;
  fieldPath?: string[];
  details?: Record<string, unknown>;
};

export type BuyerIntentResult<T> =
  | { success: true; value: T }
  | { success: false; error: BuyerIntentError };
