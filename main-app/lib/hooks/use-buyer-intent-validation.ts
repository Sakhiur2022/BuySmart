'use client';

import { useCallback, useMemo, useState } from 'react';

import type { BuyerIntent, BuyerIntentType } from '@/lib/chatbot/buyer-intent/types';
import type { BuyerIntentError } from '@/lib/chatbot/buyer-intent/errors';
import { validateBuyerIntentOutput } from '@/lib/chatbot/buyer-intent/validation';
import type { IntentResolutionStrategyRegistry } from '@/lib/chatbot/buyer-intent/strategies';
import type { IntentValidationEventEmitter } from '@/lib/chatbot/buyer-intent/events';

export type BuyerIntentValidationState = {
  intentType: BuyerIntentType | null;
  intent: BuyerIntent | null;
  errorsByField: Record<string, string[]>;
  isLoading: boolean;
};

function groupError(error: BuyerIntentError | null): Record<string, string[]> {
  if (!error) {
    return {};
  }

  const key = error.fieldPath?.join('.') || 'form';
  return { [key]: [error.message] };
}

export function useBuyerIntentValidation(input?: {
  strategyRegistry?: IntentResolutionStrategyRegistry;
  eventEmitter?: IntentValidationEventEmitter;
}) {
  const [intentType, setIntentType] = useState<BuyerIntentType | null>(null);
  const [intent, setIntent] = useState<BuyerIntent | null>(null);
  const [errorsByField, setErrorsByField] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState(false);

  const reset = useCallback(() => {
    setIntentType(null);
    setIntent(null);
    setErrorsByField({});
    setIsLoading(false);
  }, []);

  const validate = useCallback(
    async (rawOutput: unknown) => {
      setIsLoading(true);
      const result = validateBuyerIntentOutput(rawOutput, {
        strategyRegistry: input?.strategyRegistry,
        eventEmitter: input?.eventEmitter,
      });

      if (result.success) {
        setIntentType(result.intentType ?? null);
        setIntent(result.value);
        setErrorsByField({});
      } else {
        setIntentType(result.intentType ?? null);
        setIntent(null);
        setErrorsByField(groupError(result.error));
      }

      setIsLoading(false);
      return result;
    },
    [input?.eventEmitter, input?.strategyRegistry],
  );

  const state: BuyerIntentValidationState = useMemo(
    () => ({ intentType, intent, errorsByField, isLoading }),
    [errorsByField, intent, intentType, isLoading],
  );

  return {
    ...state,
    validate,
    reset,
  };
}
