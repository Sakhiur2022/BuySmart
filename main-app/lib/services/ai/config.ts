import { z } from "zod";

import type { AIModelConfig } from "@/lib/types/ai.types";

const aiEnvSchema = z.object({
  HUGGINGFACE_API_KEY: z.string().default(""),
  HF_LLM_MODEL: z.string().default("mistralai/Mixtral-8x7B-Instruct-v0.1"),
  HF_EMBEDDING_MODEL: z
    .string()
    .default("sentence-transformers/all-MiniLM-L6-v2"),
  HF_SENTIMENT_MODEL: z
    .string()
    .default("cardiffnlp/twitter-roberta-base-sentiment-latest"),
  HF_CHAT_MODEL: z.string().default("meta-llama/Meta-Llama-3-8B-Instruct"),
  HF_CLASSIFICATION_MODEL: z.string().default("facebook/bart-large-mnli"),
  AI_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.7),
  AI_MAX_TOKENS: z.coerce.number().int().min(1).max(8192).default(1024),
  AI_TOP_P: z.coerce.number().min(0).max(1).default(0.9),
  HF_INFERENCE_ENDPOINT: z
    .string()
    .default("https://api-inference.huggingface.co/models/"),
  HF_RATE_LIMIT_DELAY: z.coerce.number().int().min(0).default(100),
  HF_MAX_RETRIES: z.coerce.number().int().min(0).default(3),
});

export const aiEnv = aiEnvSchema.parse(process.env);

export const aiModels: Record<string, AIModelConfig> = {
  llm: {
    id: aiEnv.HF_LLM_MODEL,
    task: "text-generation",
    temperature: aiEnv.AI_TEMPERATURE,
    maxTokens: aiEnv.AI_MAX_TOKENS,
    topP: aiEnv.AI_TOP_P,
  },
  chat: {
    id: aiEnv.HF_CHAT_MODEL,
    task: "chat",
    temperature: aiEnv.AI_TEMPERATURE,
    maxTokens: aiEnv.AI_MAX_TOKENS,
    topP: aiEnv.AI_TOP_P,
  },
  embeddings: {
    id: aiEnv.HF_EMBEDDING_MODEL,
    task: "embeddings",
  },
  sentiment: {
    id: aiEnv.HF_SENTIMENT_MODEL,
    task: "sentiment",
  },
  classification: {
    id: aiEnv.HF_CLASSIFICATION_MODEL,
    task: "classification",
  },
};

export function isAIConfigured(): boolean {
  return aiEnv.HUGGINGFACE_API_KEY.trim().length > 0;
}

export function assertAIConfigured(): void {
  if (!isAIConfigured()) {
    throw new Error(
      "HUGGINGFACE_API_KEY is missing. Add it to .env.local before running AI features.",
    );
  }
}
