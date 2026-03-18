import { z } from 'zod';

import type { AIModelConfig } from '@/lib/types/ai.types';

const aiEnvSchema = z.object({
  GROQ_API_KEY: z.string().default(''),
  GROQ_LLM_MODEL: z.string().default('openai/gpt-oss-120b'),
  GROQ_CHAT_MODEL: z.string().default('openai/gpt-oss-120b'),
  AI_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.7),
  AI_MAX_TOKENS: z.coerce.number().int().min(1).max(8192).default(1024),
  AI_TOP_P: z.coerce.number().min(0).max(1).default(0.9),
  GROQ_RATE_LIMIT_DELAY: z.coerce.number().int().min(0).default(100),
  GROQ_MAX_RETRIES: z.coerce.number().int().min(0).default(3),
});

export const aiEnv = aiEnvSchema.parse(process.env);

export const aiModels: Record<string, AIModelConfig> = {
  llm: {
    id: aiEnv.GROQ_LLM_MODEL,
    task: 'text-generation',
    temperature: aiEnv.AI_TEMPERATURE,
    maxTokens: aiEnv.AI_MAX_TOKENS,
    topP: aiEnv.AI_TOP_P,
  },
  chat: {
    id: aiEnv.GROQ_CHAT_MODEL,
    task: 'chat',
    temperature: aiEnv.AI_TEMPERATURE,
    maxTokens: aiEnv.AI_MAX_TOKENS,
    topP: aiEnv.AI_TOP_P,
  },
};

export function isAIConfigured(): boolean {
  return aiEnv.GROQ_API_KEY.trim().length > 0;
}

export function assertAIConfigured(): void {
  if (!isAIConfigured()) {
    throw new Error('GROQ_API_KEY is missing. Add it to .env.local before running AI features.');
  }
}
