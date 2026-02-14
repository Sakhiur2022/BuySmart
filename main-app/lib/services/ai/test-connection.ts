import { assertAIConfigured, aiModels } from "@/lib/services/ai/config";
import { analyzeSentiment } from "@/lib/services/ai/models/sentiment";

export interface ConnectionTestResult {
  ok: boolean;
  model: string;
  message: string;
}

export async function testHuggingFaceConnection(): Promise<ConnectionTestResult> {
  try {
    assertAIConfigured();

    await analyzeSentiment("This setup test should succeed.");

    return {
      ok: true,
      model: aiModels.sentiment.id,
      message: "Hugging Face API connection succeeded.",
    };
  } catch (error) {
    return {
      ok: false,
      model: aiModels.sentiment.id,
      message: error instanceof Error ? error.message : "Unknown connection error",
    };
  }
}
