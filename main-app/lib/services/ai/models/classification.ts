import { aiModels } from "@/lib/services/ai/config";
import { invokeHuggingFaceModel } from "@/lib/services/ai/hf-client";
import { AIResponseError } from "@/lib/services/ai/error-handler";
import type { AIClassificationResponse } from "@/lib/types/ai.types";

interface HFZeroShotResponse {
  labels?: string[];
  scores?: number[];
}

interface ClassifyInput {
  text: string;
  candidateLabels: string[];
  multiLabel?: boolean;
}

export async function classifyText(
  input: ClassifyInput,
): Promise<AIClassificationResponse> {
  const payload = {
    inputs: input.text,
    parameters: {
      candidate_labels: input.candidateLabels,
      multi_label: input.multiLabel ?? false,
    },
  };

  const raw = await invokeHuggingFaceModel<HFZeroShotResponse>(
    aiModels.classification.id,
    payload,
    { cache: true, cacheTtlMs: 10 * 60 * 1000 },
  );

  const labels = raw.labels ?? [];
  const scores = raw.scores ?? [];

  if (labels.length === 0 || scores.length === 0) {
    throw new AIResponseError("Hugging Face classification response is empty.");
  }

  return {
    labels,
    scores,
    topLabel: labels[0],
    topScore: scores[0],
    model: aiModels.classification.id,
  };
}
