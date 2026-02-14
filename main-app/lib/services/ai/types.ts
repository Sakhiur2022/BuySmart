import type {
  AIChatMessage,
  AIClassificationResponse,
  AIEmbeddingResponse,
  AIModelConfig,
  AIRequestOptions,
  AISentimentResponse,
  AITextGenerationResponse,
} from "@/lib/types/ai.types";

export type { AIChatMessage, AIModelConfig, AIRequestOptions };
export type {
  AIClassificationResponse,
  AIEmbeddingResponse,
  AISentimentResponse,
  AITextGenerationResponse,
};

export interface HFInvokeOptions {
  cache?: boolean;
  cacheTtlMs?: number;
  signal?: AbortSignal;
}

export interface HFServiceConfig {
  apiKey: string;
  inferenceEndpoint: string;
  maxRetries: number;
  rateLimitDelayMs: number;
}
