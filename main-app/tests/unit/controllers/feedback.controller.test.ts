import { describe, expect, it, vi } from 'vitest';

import { buildFeedback } from '@/tests/factories/feedback.factory';

vi.mock('@/lib/services/feedback.service', () => ({
  createFeedbackForUser: vi.fn(),
}));

vi.mock('@/lib/services/feedback-analysis.service', () => ({
  analyzeFeedbackSentimentForCreatedFeedback: vi.fn(),
  analyzeFeedbackSentimentForScope: vi.fn(),
}));

import { createFeedbackForUser } from '@/lib/services/feedback.service';
import {
  analyzeFeedbackSentimentForCreatedFeedback,
  analyzeFeedbackSentimentForScope,
} from '@/lib/services/feedback-analysis.service';
import { analyzeFeedbackSentiment, createFeedback } from '@/lib/controllers/feedback.controller';

describe('analyzeFeedbackSentiment controller', () => {
  it('delegates to service and returns the same shape', async () => {
    const feedback = buildFeedback();

    vi.mocked(analyzeFeedbackSentimentForScope).mockResolvedValue({
      feedback,
      analysis: {
        feedbackId: feedback.feedback_id,
        label: 'positive',
        sentiment: 'positive',
        score: 0.91,
        confidence: 0.91,
        confidenceScore: 0.91,
        category: 'product_quality',
        urgency: 'low',
        reasoningSummary: 'Positive sentiment based on quality cues.',
        keySignals: ['great quality'],
      },
    });

    const result = await analyzeFeedbackSentiment('user-test-1', feedback.feedback_id);

    expect(analyzeFeedbackSentimentForScope).toHaveBeenCalledWith(
      'user-test-1',
      feedback.feedback_id,
    );
    expect(result.feedback.feedback_id).toBe(feedback.feedback_id);
    expect(result.analysis.sentiment).toBe('positive');
  });
});

describe('createFeedback controller', () => {
  it('creates feedback and runs submit-time sentiment analysis through service layer', async () => {
    const feedback = buildFeedback();

    vi.mocked(createFeedbackForUser).mockResolvedValue(feedback);
    vi.mocked(analyzeFeedbackSentimentForCreatedFeedback).mockResolvedValue({
      ...feedback,
      ai_sentiment: 'positive',
      ai_confidence_score: 0.93,
    });

    const result = await createFeedback('user-test-1', {
      feedback_type: 'product_review',
      product_id: feedback.product_id ?? undefined,
      title: feedback.title ?? undefined,
      comment: feedback.comment ?? undefined,
    });

    expect(createFeedbackForUser).toHaveBeenCalledWith('user-test-1', {
      feedback_type: 'product_review',
      product_id: feedback.product_id ?? undefined,
      title: feedback.title ?? undefined,
      comment: feedback.comment ?? undefined,
    });
    expect(analyzeFeedbackSentimentForCreatedFeedback).toHaveBeenCalledWith(
      'user-test-1',
      feedback,
    );
    expect(result.ai_sentiment).toBe('positive');
  });
});
