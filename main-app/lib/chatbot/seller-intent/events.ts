export interface IntentValidationEventEmitter {
  emitValidationSuccess?: (payload: unknown) => void;
  emitValidationError?: (error: unknown) => void;
}

export const noopEmitter: IntentValidationEventEmitter = {};
