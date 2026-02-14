export type AISupportedTask =
  | "text-generation"
  | "chat"
  | "embeddings"
  | "sentiment"
  | "classification";

export type AISentimentLabel = "positive" | "neutral" | "negative";

export interface AIModelConfig {
  id: string;
  task: AISupportedTask;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export interface AIRequestOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  signal?: AbortSignal;
}

export interface AIChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AITextGenerationRequest {
  prompt: string;
  options?: AIRequestOptions;
}

export interface AITextGenerationResponse {
  text: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AIEmbeddingResponse {
  embedding: number[];
  dimensions: number;
  model: string;
}

export interface AISentimentResponse {
  label: AISentimentLabel;
  confidence: number;
  rawLabel: string;
  model: string;
}

export interface AIClassificationResponse {
  labels: string[];
  scores: number[];
  topLabel: string;
  topScore: number;
  model: string;
}
