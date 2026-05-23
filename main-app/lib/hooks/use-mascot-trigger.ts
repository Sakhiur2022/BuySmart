'use client';

import { useEffect, useMemo, useState } from 'react';

import type { BuyerIntentType } from '@/lib/chatbot/buyer-intent/types';
import type { IntentValidationEvent } from '@/lib/chatbot/buyer-intent/events';
import { getIntentValidationEventEmitter } from '@/lib/chatbot/buyer-intent/events';

export type MascotState = 'idle' | 'empathy' | 'celebrate' | 'fallback' | 'neutral';

export type MascotTriggerConfig = {
  emitter?: ReturnType<typeof getIntentValidationEventEmitter>;
  mapEvent?: (event: IntentValidationEvent) => MascotState | null;
};

function defaultMapper(event: IntentValidationEvent): MascotState | null {
  if (event.type === 'validation_failed' || event.type === 'unknown_intent') {
    return 'fallback';
  }

  if (event.type === 'validation_succeeded') {
    switch (event.intentType as BuyerIntentType) {
      case 'REFUND_REQUEST':
        return 'empathy';
      case 'PRODUCT_RECOMMENDATION':
        return 'neutral';
      case 'POLICY_QA':
        return 'neutral';
      default:
        return 'neutral';
    }
  }

  return null;
}

export function useMascotTrigger(config?: MascotTriggerConfig) {
  const [state, setState] = useState<MascotState>('idle');
  const emitter = config?.emitter ?? getIntentValidationEventEmitter();
  const mapper = config?.mapEvent ?? defaultMapper;

  useEffect(() => {
    const handler = (event: IntentValidationEvent) => {
      const next = mapper(event);
      if (next) {
        setState(next);
      }
    };

    const offSuccess = emitter.on('validation_succeeded', handler);
    const offFailure = emitter.on('validation_failed', handler);
    const offUnknown = emitter.on('unknown_intent', handler);

    return () => {
      offSuccess();
      offFailure();
      offUnknown();
    };
  }, [emitter, mapper]);

  return useMemo(() => ({ mascotState: state, setMascotState: setState }), [state]);
}
