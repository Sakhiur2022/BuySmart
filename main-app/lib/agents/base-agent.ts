import { createHFCompletionChain } from "@/lib/services/ai/langchain-hf";
import { normalizeAIError } from "@/lib/services/ai/error-handler";
import { TTLCache } from "@/lib/services/ai/cache";
import type { AgentInput, AgentResult, IAgent } from "@/lib/agents/types";

export abstract class BaseAgent<TPayload = Record<string, unknown>, TResult = unknown>
  implements IAgent<TPayload, TResult>
{
  abstract readonly name: string;
  readonly version = "1.0.0";
  protected abstract readonly systemPrompt: string;
  protected abstract parseOutput(output: string): TResult;
  protected cacheTtlMs = 0;
  private readonly resultCache = new TTLCache<AgentResult<TResult>>();

  protected buildCacheKey(_: AgentInput<TPayload>): string | null {
    return null;
  }

  async run(input: AgentInput<TPayload>): Promise<AgentResult<TResult>> {
    const startedAt = performance.now();
    const cacheKey = this.cacheTtlMs > 0 ? this.buildCacheKey(input) : null;

    if (cacheKey) {
      const cached = this.resultCache.get(cacheKey);
      if (cached) {
        return {
          ...cached,
          cached: true,
        };
      }
    }

    try {
      const chain = createHFCompletionChain(this.systemPrompt);
      const response = await chain.invoke({
        input: JSON.stringify(input.payload),
      });

      const latencyMs = Math.round(performance.now() - startedAt);

      const freshResult: AgentResult<TResult> = {
        success: true,
        result: this.parseOutput(response.text),
        latencyMs,
        model: response.model,
        cached: false,
      };

      if (cacheKey) {
        this.resultCache.set(cacheKey, { ...freshResult }, this.cacheTtlMs);
      }

      return freshResult;
    } catch (error) {
      const normalized = normalizeAIError(error);
      const latencyMs = Math.round(performance.now() - startedAt);

      return {
        success: false,
        result: this.parseOutput(normalized.message),
        latencyMs,
      };
    }
  }
}
