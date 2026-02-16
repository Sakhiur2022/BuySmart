import { AIRequestError } from "@/lib/services/ai/error-handler";
import type { AIChatMessage } from "@/lib/types/ai.types";

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function approximateTokenCount(text: string): number {
  if (!text.trim()) {
    return 0;
  }

  return Math.ceil(text.split(/\s+/).length * 1.3);
}

export async function runWithRetry<T>(
  callback: () => Promise<T>,
  retries: number,
  baseDelayMs = 250,
  shouldRetry: (error: unknown) => boolean = isRetryableError,
): Promise<T> {
  let attempt = 0;

  while (attempt <= retries) {
    try {
      return await callback();
    } catch (error) {
      if (attempt === retries || !shouldRetry(error)) {
        throw error;
      }

      const delay = baseDelayMs * (attempt + 1);
      await sleep(delay);
      attempt += 1;
    }
  }

  throw new Error("Retry logic exhausted unexpectedly");
}

export function buildChatPrompt(messages: AIChatMessage[]): string {
  return messages
    .map((message) => {
      const normalized = String(message.content).replace(/\r\n/g, "\n");
      return `${message.role.toUpperCase()}: ${JSON.stringify(normalized)}`;
    })
    .join("\n\n");
}

export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function buildStableCacheKey(
  model: string,
  payload: Record<string, unknown>,
): string {
  return `${model}:${stableStringify(payload)}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const entries = keys.map((key) => {
    const serializedValue = stableStringify(record[key]);
    return `${JSON.stringify(key)}:${serializedValue}`;
  });

  return `{${entries.join(",")}}`;
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof AIRequestError) {
    if (error.status === undefined) {
      return true;
    }

    return error.status === 429 || error.status >= 500;
  }

  if (error instanceof Error && error.name === "AbortError") {
    return false;
  }

  return true;
}
