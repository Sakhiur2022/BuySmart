import { describe, expect, it, vi } from 'vitest';

import { buildFeedback } from '@/tests/factories/feedback.factory';

vi.mock('@/lib/services/feedback-analysis.service', () => ({
  analyzeFeedbackSentimentForScope: vi.fn(),
}));

import { analyzeFeedbackSentimentForScope } from '@/lib/services/feedback-analysis.service';
import { analyzeFeedbackSentiment } from '@/lib/controllers/feedback.controller';

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
