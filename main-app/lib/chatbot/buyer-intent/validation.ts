import type { ZodError } from 'zod';

import type {
  BuyerIntent,
  BuyerIntentType,
  RawBuyerIntentOutput,
} from '@/lib/chatbot/buyer-intent/types';
import type { BuyerIntentResult } from '@/lib/chatbot/buyer-intent/errors';
import { getBuyerIntentSchema } from '@/lib/chatbot/buyer-intent/registry';
import type { IntentResolutionStrategyRegistry } from '@/lib/chatbot/buyer-intent/strategies';
import type { IntentValidationEventEmitter } from '@/lib/chatbot/buyer-intent/events';

function parseJson(input: string): BuyerIntentResult<unknown> {
  try {
    return { success: true, value: JSON.parse(input) };
  } catch {
    return {
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Unable to parse intent payload as JSON.',
      },
    };
  }
}

function toRawIntent(input: unknown): BuyerIntentResult<RawBuyerIntentOutput> {
  if (typeof input === 'string') {
    const parsed = parseJson(input);
    if (!parsed.success) {
      return parsed;
    }

    return { success: true, value: parsed.value as RawBuyerIntentOutput };
  }

  return { success: true, value: input as RawBuyerIntentOutput };
}

function extractIntentType(input: RawBuyerIntentOutput): BuyerIntentResult<BuyerIntentType> {
  const intent = input?.intent;
  if (!intent || typeof intent !== 'string') {
    return {
      success: false,
      error: {
        code: 'MISSING_INTENT',
        message: 'Intent type is missing from the payload.',
        fieldPath: ['intent'],
      },
    };
  }

  if (
    intent !== 'REFUND_REQUEST' &&
    intent !== 'PRODUCT_RECOMMENDATION' &&
    intent !== 'POLICY_QA'
  ) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_INTENT',
        message: `Intent type "${intent}" is not supported.`,
        fieldPath: ['intent'],
      },
    };
  }

  return { success: true, value: intent };
}

function formatZodError(error: ZodError): { message: string; fieldPath?: string[] } {
  const issue = error.issues[0];
  if (!issue) {
    return { message: 'Intent payload validation failed.' };
  }

  return {
    message: issue.message || 'Intent payload validation failed.',
    fieldPath: issue.path.map(String),
  };
}

export type BuyerIntentValidationResult = BuyerIntentResult<BuyerIntent> & {
  intentType?: BuyerIntentType;
  raw?: unknown;
};

export function validateBuyerIntentOutput(
  input: unknown,
  options?: {
    strategyRegistry?: IntentResolutionStrategyRegistry;
    eventEmitter?: IntentValidationEventEmitter;
  },
): BuyerIntentValidationResult {
  const rawResult = toRawIntent(input);
  if (!rawResult.success) {
    options?.eventEmitter?.emit({
      type: 'validation_failed',
      raw: input,
      error: rawResult.error,
      timestamp: Date.now(),
    });

    return { ...rawResult, raw: input };
  }

  const intentResult = extractIntentType(rawResult.value);
  if (!intentResult.success) {
    const intentType =
      typeof rawResult.value?.intent === 'string'
        ? (rawResult.value.intent as BuyerIntentType)
        : undefined;

    if (intentResult.error.code === 'UNKNOWN_INTENT') {
      options?.eventEmitter?.emit({
        type: 'unknown_intent',
        raw: rawResult.value,
        timestamp: Date.now(),
      });
    } else {
      options?.eventEmitter?.emit({
        type: 'validation_failed',
        raw: rawResult.value,
        intentType,
        error: intentResult.error,
        timestamp: Date.now(),
      });
    }

    return { ...intentResult, intentType, raw: rawResult.value };
  }

  const schema = getBuyerIntentSchema(intentResult.value);
  if (!schema) {
    const error = {
      code: 'SCHEMA_NOT_FOUND' as const,
      message: `No schema registered for intent: ${intentResult.value}`,
    };

    options?.eventEmitter?.emit({
      type: 'validation_failed',
      raw: rawResult.value,
      intentType: intentResult.value,
      error,
      timestamp: Date.now(),
    });

    return { success: false, error, intentType: intentResult.value, raw: rawResult.value };
  }

  const parsed = schema.safeParse(rawResult.value);
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error);
    const error = {
      code: 'INVALID_PAYLOAD' as const,
      message: formatted.message,
      fieldPath: formatted.fieldPath,
    };

    options?.eventEmitter?.emit({
      type: 'validation_failed',
      raw: rawResult.value,
      intentType: intentResult.value,
      error,
      timestamp: Date.now(),
    });

    return { success: false, error, intentType: intentResult.value, raw: rawResult.value };
  }

  const validatedIntent = parsed.data;
  const strategy = options?.strategyRegistry?.get(validatedIntent.intent);

  if (strategy) {
    const resolved = strategy.resolve(validatedIntent);
    if (!resolved.success) {
      options?.eventEmitter?.emit({
        type: 'validation_failed',
        raw: rawResult.value,
        intentType: intentResult.value,
        error: resolved.error,
        timestamp: Date.now(),
      });

      return { ...resolved, intentType: intentResult.value, raw: rawResult.value };
    }

    options?.eventEmitter?.emit({
      type: 'validation_succeeded',
      intentType: resolved.value.intent,
      payload: resolved.value,
      timestamp: Date.now(),
    });

    return { ...resolved, intentType: intentResult.value, raw: rawResult.value };
  }

  options?.eventEmitter?.emit({
    type: 'validation_succeeded',
    intentType: validatedIntent.intent,
    payload: validatedIntent,
    timestamp: Date.now(),
  });

  return {
    success: true,
    value: validatedIntent,
    intentType: validatedIntent.intent,
    raw: rawResult.value,
  };
}
