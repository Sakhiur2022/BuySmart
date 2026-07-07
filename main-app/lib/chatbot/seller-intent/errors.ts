export type SellerIntentError = {
  code: string;
  message: string;
  fieldPath?: string[];
  details?: Record<string, unknown>;
};

export type SellerIntentResult<T> =
  | { success: true; value: T }
  | { success: false; error: SellerIntentError };
