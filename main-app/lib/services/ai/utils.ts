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
): Promise<T> {
  let attempt = 0;

  while (attempt <= retries) {
    try {
      return await callback();
    } catch (error) {
      if (attempt === retries) {
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
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n\n");
}

export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function buildStableCacheKey(
  model: string,
  payload: Record<string, unknown>,
): string {
  return `${model}:${JSON.stringify(payload)}`;
}
