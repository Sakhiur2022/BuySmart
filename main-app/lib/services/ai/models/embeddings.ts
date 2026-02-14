import { aiModels } from "@/lib/services/ai/config";
import { invokeHuggingFaceModel } from "@/lib/services/ai/hf-client";
import { AIResponseError } from "@/lib/services/ai/error-handler";
import type { AIEmbeddingResponse } from "@/lib/types/ai.types";

type HFEmbeddingResponse = number[] | number[][];

export async function generateEmbedding(
  input: string,
): Promise<AIEmbeddingResponse> {
  const payload = {
    inputs: input,
  };

  const raw = await invokeHuggingFaceModel<HFEmbeddingResponse>(
    aiModels.embeddings.id,
    payload,
    { cache: true, cacheTtlMs: 15 * 60 * 1000 },
  );

  const embedding = Array.isArray(raw[0]) ? (raw[0] as number[]) : (raw as number[]);

  if (!embedding || embedding.length === 0) {
    throw new AIResponseError("Hugging Face embeddings response is empty.");
  }

  return {
    embedding,
    dimensions: embedding.length,
    model: aiModels.embeddings.id,
  };
}
