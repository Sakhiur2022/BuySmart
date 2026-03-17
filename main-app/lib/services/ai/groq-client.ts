import { Groq } from 'groq-sdk';

import { aiEnv, assertAIConfigured } from '@/lib/services/ai/config';
import { TTLCache } from '@/lib/services/ai/cache';
import { AIConfigurationError, AIRequestError } from '@/lib/services/ai/error-handler';
import { SimpleRateLimiter } from '@/lib/services/ai/rate-limiter';
import type { GroqInvokeOptions } from '@/lib/services/ai/types';
import { buildStableCacheKey, runWithRetry } from '@/lib/services/ai/utils';

export const groqClient = new Groq({
  apiKey: aiEnv.GROQ_API_KEY,
});

const responseCache = new TTLCache<unknown>();
const limiter = new SimpleRateLimiter(aiEnv.GROQ_RATE_LIMIT_DELAY);

function createAuthHeaders(): HeadersInit {
  if (!aiEnv.GROQ_API_KEY) {
    throw new AIConfigurationError('GROQ_API_KEY is required to call Groq API.');
  }

  return {
    Authorization: `Bearer ${aiEnv.GROQ_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

export interface GroqTextGenerationPayload {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}

export async function invokeGroqModel<T>(
  model: string,
  payload: GroqTextGenerationPayload,
  options?: GroqInvokeOptions,
): Promise<T> {
  assertAIConfigured();

  const useCache = options?.cache ?? false;
  const cacheTtlMs = options?.cacheTtlMs ?? 5 * 60 * 1000;
  const cacheKey = buildStableCacheKey(model, payload as unknown as Record<string, unknown>);

  if (useCache) {
    const cached = responseCache.get(cacheKey);
    if (cached) {
      return cached as T;
    }
  }

  const timeoutMs = options?.timeoutMs ?? 30000;

  const execute = async (): Promise<T> => {
    const controller = new AbortController();
    const externalSignal = options?.signal;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const abortListener = () => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort();
      } else {
        externalSignal.addEventListener('abort', abortListener, { once: true });
      }
    }

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: createAuthHeaders(),
        body: JSON.stringify({
          model,
          messages: payload.messages,
          temperature: payload.temperature,
          max_tokens: payload.max_tokens,
          top_p: payload.top_p,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const rawErrorBody = await response.text();
        throw new AIRequestError(
          `Groq request failed (${response.status}) for ${model}: ${rawErrorBody}`,
          response.status,
        );
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeoutId);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', abortListener);
      }
    }
  };

  const result = await limiter.schedule(() => runWithRetry(execute, aiEnv.GROQ_MAX_RETRIES));

  if (useCache) {
    responseCache.set(cacheKey, result, cacheTtlMs);
  }

  return result;
}
