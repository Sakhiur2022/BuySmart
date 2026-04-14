import type { Feedback, FeedbackType } from '@/lib/models/feedback.model';
import type { Database } from '@/lib/types/database.types';

export type FeedbackAISentiment = Database['public']['Enums']['ai_sentiment_enum'];
export type FeedbackAICategory = Database['public']['Enums']['ai_feedback_category_enum'];
export type FeedbackAIUrgency = Database['public']['Enums']['ai_urgency_enum'];

export interface FeedbackSentimentAgentPayload {
  feedbackId: string;
  feedbackType: FeedbackType;
  text: string;
  title?: string | null;
}

export interface FeedbackSentimentAgentOutput {
  label: FeedbackAISentiment;
  sentiment: FeedbackAISentiment;
  score: number;
  confidence: number;
  confidenceScore: number;
  category: FeedbackAICategory;
  urgency: FeedbackAIUrgency;
  reasoningSummary: string;
  keySignals: string[];
}

export interface FeedbackSentimentPersistenceInput {
  ai_sentiment: FeedbackAISentiment;
  ai_confidence_score: number;
  ai_category: FeedbackAICategory;
  ai_urgency: FeedbackAIUrgency;
  ai_keywords: string[];
  ai_processed_at: string;
}

export interface FeedbackSentimentAnalysisMetadata {
  feedbackId: string;
  label: FeedbackAISentiment;
  sentiment: FeedbackAISentiment;
  score: number;
  confidence: number;
  confidenceScore: number;
  category: FeedbackAICategory;
  urgency: FeedbackAIUrgency;
  reasoningSummary: string;
  keySignals: string[];
  model?: string;
  latencyMs?: number;
  cached?: boolean;
}

export interface FeedbackSentimentAnalysisResult {
  feedback: Feedback;
  analysis: FeedbackSentimentAnalysisMetadata;
}
