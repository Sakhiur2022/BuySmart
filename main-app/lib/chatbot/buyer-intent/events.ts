import type { BuyerIntent, BuyerIntentType } from '@/lib/chatbot/buyer-intent/types';
import type { BuyerIntentError } from '@/lib/chatbot/buyer-intent/errors';

export type IntentValidationSucceededEvent = {
  type: 'validation_succeeded';
  intentType: BuyerIntentType;
  payload: BuyerIntent;
  timestamp: number;
};

export type IntentValidationFailedEvent = {
  type: 'validation_failed';
  intentType?: BuyerIntentType;
  error: BuyerIntentError;
  raw: unknown;
  timestamp: number;
};

export type IntentUnknownEvent = {
  type: 'unknown_intent';
  raw: unknown;
  timestamp: number;
};

export type IntentValidationEvent =
  | IntentValidationSucceededEvent
  | IntentValidationFailedEvent
  | IntentUnknownEvent;

export type IntentValidationEventType = IntentValidationEvent['type'];

type Listener = (event: IntentValidationEvent) => void;

export class IntentValidationEventEmitter {
  private readonly listeners = new Map<IntentValidationEventType, Set<Listener>>();

  on(type: IntentValidationEventType, listener: Listener): () => void {
    const set = this.listeners.get(type) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(type, set);

    return () => this.off(type, listener);
  }

  off(type: IntentValidationEventType, listener: Listener): void {
    const set = this.listeners.get(type);
    if (!set) {
      return;
    }

    set.delete(listener);
    if (set.size === 0) {
      this.listeners.delete(type);
    }
  }

  emit(event: IntentValidationEvent): void {
    const set = this.listeners.get(event.type);
    if (!set) {
      return;
    }

    set.forEach((listener) => listener(event));
  }
}

let defaultEmitter: IntentValidationEventEmitter | null = null;

export function getIntentValidationEventEmitter(): IntentValidationEventEmitter {
  if (!defaultEmitter) {
    defaultEmitter = new IntentValidationEventEmitter();
  }

  return defaultEmitter;
}
