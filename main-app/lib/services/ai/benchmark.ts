import { performance } from "node:perf_hooks";

import { classifyText } from "@/lib/services/ai/models/classification";
import { generateEmbedding } from "@/lib/services/ai/models/embeddings";
import { generateText } from "@/lib/services/ai/models/llm";
import { analyzeSentiment } from "@/lib/services/ai/models/sentiment";

interface BenchmarkEntry {
  operation: string;
  latencyMs: number;
  success: boolean;
  details?: string;
}

export async function runAIBenchmark(): Promise<BenchmarkEntry[]> {
  const results: BenchmarkEntry[] = [];

  const run = async (
    operation: string,
    task: () => Promise<unknown>,
  ): Promise<void> => {
    const startedAt = performance.now();

    try {
      const output = await task();
      const latencyMs = Math.round(performance.now() - startedAt);

      results.push({
        operation,
        latencyMs,
        success: true,
        details: typeof output === "string" ? output.slice(0, 80) : undefined,
      });
    } catch (error) {
      const latencyMs = Math.round(performance.now() - startedAt);

      results.push({
        operation,
        latencyMs,
        success: false,
        details: error instanceof Error ? error.message : "Unknown benchmark error",
      });
    }
  };

  await run("llm", async () =>
    (await generateText({ prompt: "Summarize smart shopping in one line." })).text,
  );
  await run("embeddings", async () =>
    (await generateEmbedding("Noise-cancelling headphones")).dimensions,
  );
  await run("sentiment", async () =>
    (await analyzeSentiment("Excellent quality and fast shipping")).label,
  );
  await run("classification", async () =>
    (
      await classifyText({
        text: "The parcel is late and tracking has not updated.",
        candidateLabels: ["delivery", "inventory", "refund"],
      })
    ).topLabel,
  );

  return results;
}
