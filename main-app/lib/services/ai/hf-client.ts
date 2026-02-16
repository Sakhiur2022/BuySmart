import { HfInference } from "@huggingface/inference";

import { aiEnv, assertAIConfigured } from "@/lib/services/ai/config";
import { TTLCache } from "@/lib/services/ai/cache";
import { AIConfigurationError, AIRequestError } from "@/lib/services/ai/error-handler";
import { SimpleRateLimiter } from "@/lib/services/ai/rate-limiter";
import type { HFInvokeOptions } from "@/lib/services/ai/types";
import { buildStableCacheKey, runWithRetry } from "@/lib/services/ai/utils";

export const hfInferenceClient = new HfInference(aiEnv.HUGGINGFACE_API_KEY);

const responseCache = new TTLCache<unknown>();
const limiter = new SimpleRateLimiter(aiEnv.HF_RATE_LIMIT_DELAY);

function resolveInferenceUrl(model: string): string {
  const base = aiEnv.HF_INFERENCE_ENDPOINT.endsWith("/")
    ? aiEnv.HF_INFERENCE_ENDPOINT
    : `${aiEnv.HF_INFERENCE_ENDPOINT}/`;

  return `${base}${model}`;
}

function createAuthHeaders(): HeadersInit {
  if (!aiEnv.HUGGINGFACE_API_KEY) {
    throw new AIConfigurationError(
      "HUGGINGFACE_API_KEY is required to call Hugging Face Inference API.",
    );
  }

  return {
    Authorization: `Bearer ${aiEnv.HUGGINGFACE_API_KEY}`,
    "Content-Type": "application/json",
  };
}

export async function invokeHuggingFaceModel<T>(
  model: string,
  payload: Record<string, unknown>,
  options?: HFInvokeOptions,
): Promise<T> {
  assertAIConfigured();

  const useCache = options?.cache ?? false;
  const cacheTtlMs = options?.cacheTtlMs ?? 5 * 60 * 1000;
  const cacheKey = buildStableCacheKey(model, payload);

  if (useCache) {
    const cached = responseCache.get(cacheKey);
    if (cached) {
      return cached as T;
    }
  }

  const url = resolveInferenceUrl(model);
  const timeoutMs = options?.timeoutMs ?? 15000;

  const execute = async (): Promise<T> => {
    const controller = new AbortController();
    const externalSignal = options?.signal;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const abortListener = () => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort();
      } else {
        externalSignal.addEventListener("abort", abortListener, { once: true });
      }
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: createAuthHeaders(),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const rawErrorBody = await response.text();
        throw new AIRequestError(
          `Hugging Face request failed (${response.status}): ${rawErrorBody}`,
          response.status,
        );
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeoutId);
      if (externalSignal) {
        externalSignal.removeEventListener("abort", abortListener);
      }
    }
  };

  const result = await limiter.schedule(() =>
    runWithRetry(execute, aiEnv.HF_MAX_RETRIES),
  );

  if (useCache) {
    responseCache.set(cacheKey, result, cacheTtlMs);
  }

  return result;
}
