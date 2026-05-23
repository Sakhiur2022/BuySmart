export type BuyerIntentErrorCode =
  | 'INVALID_JSON'
  | 'MISSING_INTENT'
  | 'UNKNOWN_INTENT'
  | 'SCHEMA_NOT_FOUND'
  | 'INVALID_PAYLOAD'
  | 'STRATEGY_NOT_FOUND'
  | 'ADAPTER_ERROR'
  | 'TOOL_NOT_FOUND';

export type BuyerIntentError = {
  code: BuyerIntentErrorCode;
  message: string;
  fieldPath?: string[];
  details?: Record<string, unknown>;
};

export type BuyerIntentResult<T> =
  | { success: true; value: T }
  | { success: false; error: BuyerIntentError };
