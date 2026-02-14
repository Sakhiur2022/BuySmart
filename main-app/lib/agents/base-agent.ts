import { createHFCompletionChain } from "@/lib/services/ai/langchain-hf";
import { normalizeAIError } from "@/lib/services/ai/error-handler";
import type { AgentInput, AgentResult, IAgent } from "@/lib/agents/types";

export abstract class BaseAgent<TPayload = Record<string, unknown>, TResult = unknown>
  implements IAgent<TPayload, TResult>
{
  abstract readonly name: string;
  protected abstract readonly systemPrompt: string;
  protected abstract parseOutput(output: string): TResult;

  async run(input: AgentInput<TPayload>): Promise<AgentResult<TResult>> {
    const startedAt = performance.now();

    try {
      const chain = createHFCompletionChain(this.systemPrompt);
      const output = await chain.invoke({
        input: JSON.stringify(input.payload),
      });

      const latencyMs = Math.round(performance.now() - startedAt);

      return {
        success: true,
        result: this.parseOutput(output),
        latencyMs,
      };
    } catch (error) {
      const normalized = normalizeAIError(error);

      return {
        success: false,
        result: this.parseOutput(normalized.message),
      };
    }
  }
}
