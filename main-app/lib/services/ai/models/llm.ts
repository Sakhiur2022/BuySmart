import { aiEnv, aiModels } from "@/lib/services/ai/config";
import { invokeHuggingFaceModel } from "@/lib/services/ai/hf-client";
import { AIResponseError } from "@/lib/services/ai/error-handler";
import { approximateTokenCount, buildChatPrompt, normalizeWhitespace } from "@/lib/services/ai/utils";
import type {
  AIChatMessage,
  AIRequestOptions,
  AITextGenerationResponse,
} from "@/lib/types/ai.types";

interface HFGenerationResponseItem {
  generated_text?: string;
}

type HFGenerationResponse = HFGenerationResponseItem[] | HFGenerationResponseItem;

interface GenerateTextInput {
  prompt: string;
  model?: string;
  options?: AIRequestOptions;
}

export async function generateText(
  input: GenerateTextInput,
): Promise<AITextGenerationResponse> {
  const model = input.model ?? aiModels.llm.id;

  const payload = {
    inputs: input.prompt,
    parameters: {
      temperature: input.options?.temperature ?? aiEnv.AI_TEMPERATURE,
      max_new_tokens: input.options?.maxTokens ?? aiEnv.AI_MAX_TOKENS,
      top_p: input.options?.topP ?? aiEnv.AI_TOP_P,
      return_full_text: false,
    },
  };

  const rawResponse = await invokeHuggingFaceModel<HFGenerationResponse>(
    model,
    payload,
    { cache: false, signal: input.options?.signal },
  );

  const generatedText = Array.isArray(rawResponse)
    ? rawResponse[0]?.generated_text
    : rawResponse.generated_text;

  if (!generatedText) {
    throw new AIResponseError("Hugging Face text generation returned empty output.");
  }

  const normalizedText = normalizeWhitespace(generatedText);
  const promptTokens = approximateTokenCount(input.prompt);
  const completionTokens = approximateTokenCount(normalizedText);

  return {
    text: normalizedText,
    model,
    usage: {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    },
  };
}

export async function generateChatCompletion(
  messages: AIChatMessage[],
  options?: AIRequestOptions,
): Promise<AITextGenerationResponse> {
  const prompt = buildChatPrompt(messages);

  return generateText({
    prompt,
    model: aiModels.chat.id,
    options,
  });
}
