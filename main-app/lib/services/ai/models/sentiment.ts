import { aiModels } from "@/lib/services/ai/config";
import { invokeHuggingFaceModel } from "@/lib/services/ai/hf-client";
import { AIResponseError } from "@/lib/services/ai/error-handler";
import type { AISentimentLabel, AISentimentResponse } from "@/lib/types/ai.types";

interface HFLabelScore {
  label: string;
  score: number;
}

type HFSentimentResponse = HFLabelScore[] | HFLabelScore[][];

function mapLabel(rawLabel: string): AISentimentLabel {
  const normalized = rawLabel.toLowerCase();

  if (normalized.includes("neg")) {
    return "negative";
  }

  if (normalized.includes("neu")) {
    return "neutral";
  }

  return "positive";
}

export async function analyzeSentiment(
  text: string,
): Promise<AISentimentResponse> {
  const payload = {
    inputs: text,
  };

  const raw = await invokeHuggingFaceModel<HFSentimentResponse>(
    aiModels.sentiment.id,
    payload,
    { cache: true, cacheTtlMs: 10 * 60 * 1000 },
  );

  const results = Array.isArray(raw[0]) ? (raw[0] as HFLabelScore[]) : (raw as HFLabelScore[]);
  const best = [...results].sort((a, b) => b.score - a.score)[0];

  if (!best) {
    throw new AIResponseError("Hugging Face sentiment response is empty.");
  }

  return {
    label: mapLabel(best.label),
    confidence: best.score,
    rawLabel: best.label,
    model: aiModels.sentiment.id,
  };
}
