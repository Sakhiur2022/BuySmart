import type { RefundRequestToolInput } from '@/lib/chatbot/buyer-intent/tool-factory';

export type RefundSubmitExecutor = (input: RefundRequestToolInput) => Promise<unknown>;

export type RefundRetryPolicy = {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
};

const DEFAULT_POLICY: RefundRetryPolicy = {
  maxAttempts: 2,
  initialDelayMs: 250,
  maxDelayMs: 800,
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextDelay(attempt: number, policy: RefundRetryPolicy) {
  const scaled = policy.initialDelayMs * Math.pow(2, attempt - 1);
  return Math.min(policy.maxDelayMs, scaled);
}

export function withRetry(
  executor: RefundSubmitExecutor,
  shouldRetry: (error: unknown) => boolean,
  policy: RefundRetryPolicy = DEFAULT_POLICY,
): RefundSubmitExecutor {
  return async (input) => {
    let attempt = 0;
    let lastError: unknown;

    while (attempt < policy.maxAttempts) {
      try {
        return await executor(input);
      } catch (error) {
        lastError = error;
        attempt += 1;
        if (!shouldRetry(error) || attempt >= policy.maxAttempts) {
          break;
        }

        await delay(nextDelay(attempt, policy));
      }
    }

    throw lastError;
  };
}
