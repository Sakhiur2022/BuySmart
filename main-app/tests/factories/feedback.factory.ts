import type { Feedback } from '@/lib/models/feedback.model';
import type {
  FeedbackSentimentAgentOutput,
  FeedbackSentimentPersistenceInput,
} from '@/lib/types/feedback-sentiment.types';

export function buildFeedback(overrides: Partial<Feedback> = {}): Feedback {
  return {
    feedback_id: 'a52e8265-3ea2-4af4-a741-8f91da4eb1d1',
    user_id: 'de67d2b3-4bf7-49f2-8bd0-2e9d95f0a4ca',
    feedback_type: 'product_review',
    product_id: 'b03e1c18-d08a-4f39-ad8c-c10f8f541838',
    order_id: 'cae2b8c0-ef39-4f4a-91ab-b8b74a4ef240',
    order_item_id: '7f8844a5-2b63-470f-a0eb-62dba4fe8f74',
    rating: 5,
    title: 'Great product',
    comment: 'Quality was better than expected.',
    images: null,
    is_verified_purchase: true,
    status: 'published',
    is_helpful: 0,
    is_reported: false,
    moderator_id: null,
    moderated_at: null,
    ai_sentiment: null,
    ai_confidence_score: null,
    ai_category: null,
    ai_urgency: null,
    ai_keywords: null,
    ai_processed_at: null,
    created_at: '2026-04-13T00:00:00.000Z',
    updated_at: '2026-04-13T00:00:00.000Z',
    ...overrides,
  };
}

export function buildSentimentAgentOutput(
  overrides: Partial<FeedbackSentimentAgentOutput> = {},
): FeedbackSentimentAgentOutput {
  return {
    label: 'positive',
    sentiment: 'positive',
    score: 0.92,
    confidence: 0.92,
    confidenceScore: 0.92,
    category: 'product_quality',
    urgency: 'low',
    reasoningSummary: 'The feedback is favorable and highlights product quality.',
    keySignals: ['great quality', 'better than expected'],
    ...overrides,
  };
}

export function buildSentimentPersistenceInput(
  overrides: Partial<FeedbackSentimentPersistenceInput> = {},
): FeedbackSentimentPersistenceInput {
  return {
    ai_sentiment: 'positive',
    ai_confidence_score: 0.92,
    ai_category: 'product_quality',
    ai_urgency: 'low',
    ai_keywords: ['great quality', 'better than expected'],
    ai_processed_at: '2026-04-13T00:00:00.000Z',
    ...overrides,
  };
}
