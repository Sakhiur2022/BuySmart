import { generateEmbedding } from "@/lib/services/ai/models/embeddings";
import { classifyText } from "@/lib/services/ai/models/classification";
import { generateText } from "@/lib/services/ai/models/llm";
import { analyzeSentiment } from "@/lib/services/ai/models/sentiment";

export interface ModelTestStatus {
  name: string;
  ok: boolean;
  details: string;
}

export interface ModelTestReport {
  ok: boolean;
  results: ModelTestStatus[];
}

export async function testAllAIModels(): Promise<ModelTestReport> {
  const results: ModelTestStatus[] = [];

  try {
    const generated = await generateText({ prompt: "Write one sentence about e-commerce." });
    results.push({
      name: "llm",
      ok: generated.text.length > 0,
      details: generated.text.slice(0, 120),
    });
  } catch (error) {
    results.push({
      name: "llm",
      ok: false,
      details: error instanceof Error ? error.message : "Unknown LLM error",
    });
  }

  try {
    const embedding = await generateEmbedding("Wireless ergonomic keyboard");
    results.push({
      name: "embeddings",
      ok: embedding.dimensions > 0,
      details: `dimensions=${embedding.dimensions}`,
    });
  } catch (error) {
    results.push({
      name: "embeddings",
      ok: false,
      details: error instanceof Error ? error.message : "Unknown embedding error",
    });
  }

  try {
    const sentiment = await analyzeSentiment("The packaging was damaged and I am upset.");
    results.push({
      name: "sentiment",
      ok: sentiment.confidence > 0,
      details: `${sentiment.label} (${sentiment.confidence.toFixed(2)})`,
    });
  } catch (error) {
    results.push({
      name: "sentiment",
      ok: false,
      details: error instanceof Error ? error.message : "Unknown sentiment error",
    });
  }

  try {
    const classification = await classifyText({
      text: "The product arrived late and support did not respond.",
      candidateLabels: ["delivery", "customer_service", "pricing", "product_quality"],
    });

    results.push({
      name: "classification",
      ok: classification.topLabel.length > 0,
      details: `${classification.topLabel} (${classification.topScore.toFixed(2)})`,
    });
  } catch (error) {
    results.push({
      name: "classification",
      ok: false,
      details: error instanceof Error ? error.message : "Unknown classification error",
    });
  }

  return {
    ok: results.every((result) => result.ok),
    results,
  };
}
