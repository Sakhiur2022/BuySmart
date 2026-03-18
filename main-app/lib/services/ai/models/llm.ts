import { aiEnv, aiModels } from '@/lib/services/ai/config';
import { invokeGroqModel, type GroqTextGenerationPayload } from '@/lib/services/ai/groq-client';
import { AIRequestError, AIResponseError } from '@/lib/services/ai/error-handler';
import { approximateTokenCount, normalizeWhitespace } from '@/lib/services/ai/utils';
import type {
  AIChatMessage,
  AIRequestOptions,
  AITextGenerationResponse,
} from '@/lib/types/ai.types';

interface GroqCompletionResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface GenerateTextInput {
  prompt: string;
  model?: string;
  options?: AIRequestOptions;
}

export async function generateText(input: GenerateTextInput): Promise<AITextGenerationResponse> {
  if (!input.prompt.trim()) {
    throw new AIRequestError('Text generation prompt must be a non-empty string.');
  }

  const model = input.model ?? aiModels.llm.id;

  const payload: GroqTextGenerationPayload = {
    messages: [
      {
        role: 'user',
        content: input.prompt,
      },
    ],
    temperature: input.options?.temperature ?? aiEnv.AI_TEMPERATURE,
    max_tokens: input.options?.maxTokens ?? aiEnv.AI_MAX_TOKENS,
    top_p: input.options?.topP ?? aiEnv.AI_TOP_P,
  };

  const rawResponse = await invokeGroqModel<GroqCompletionResponse>(model, payload, {
    cache: false,
    signal: input.options?.signal,
  });

  const generatedText = rawResponse.choices[0]?.message?.content;

  if (!generatedText) {
    throw new AIResponseError('Groq text generation returned empty output.');
  }

  const normalizedText = normalizeWhitespace(generatedText);

  return {
    text: normalizedText,
    model,
    usage: {
      promptTokens: rawResponse.usage.prompt_tokens,
      completionTokens: rawResponse.usage.completion_tokens,
      totalTokens: rawResponse.usage.total_tokens,
    },
  };
}

export async function generateChatCompletion(
  messages: AIChatMessage[],
  options?: AIRequestOptions,
): Promise<AITextGenerationResponse> {
  if (messages.length === 0) {
    throw new AIRequestError('Chat completion requires at least one message.');
  }

  const model = aiModels.chat.id;

  const payload: GroqTextGenerationPayload = {
    messages: messages.map((msg) => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content,
    })),
    temperature: options?.temperature ?? aiEnv.AI_TEMPERATURE,
    max_tokens: options?.maxTokens ?? aiEnv.AI_MAX_TOKENS,
    top_p: options?.topP ?? aiEnv.AI_TOP_P,
  };

  const rawResponse = await invokeGroqModel<GroqCompletionResponse>(model, payload, {
    cache: false,
    signal: options?.signal,
  });

  const generatedText = rawResponse.choices[0]?.message?.content;

  if (!generatedText) {
    throw new AIResponseError('Groq chat completion returned empty output.');
  }

  const normalizedText = normalizeWhitespace(generatedText);

  return {
    text: normalizedText,
    model,
    usage: {
      promptTokens: rawResponse.usage.prompt_tokens,
      completionTokens: rawResponse.usage.completion_tokens,
      totalTokens: rawResponse.usage.total_tokens,
    },
  };
}
