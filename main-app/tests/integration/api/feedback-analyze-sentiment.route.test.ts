import { describe, expect, it, vi } from 'vitest';

import { createJsonRequest, createRouteParams } from '@/tests/helpers/api-request';

vi.mock('@/app/api/cart/_shared', () => ({
  requireAuthenticatedUser: vi.fn(),
}));

vi.mock('@/lib/controllers/feedback.controller', () => ({
  analyzeFeedbackSentiment: vi.fn(),
}));

import { requireAuthenticatedUser } from '@/app/api/cart/_shared';
import { analyzeFeedbackSentiment } from '@/lib/controllers/feedback.controller';
import { POST } from '@/app/api/feedback/[id]/analyze-sentiment/route';

describe('POST /api/feedback/[id]/analyze-sentiment', () => {
  it('returns 200 with analyzed sentiment payload for authenticated users', async () => {
    const feedbackId = '84213b38-4a50-4b68-bc3d-b2ba3fdc6f5d';

    vi.mocked(requireAuthenticatedUser).mockResolvedValue({ userId: 'user-test-1' });
    vi.mocked(analyzeFeedbackSentiment).mockResolvedValue({
      feedback: {
        feedback_id: feedbackId,
      },
      analysis: {
        feedbackId,
        sentiment: 'positive',
        confidenceScore: 0.89,
        category: 'product_quality',
        urgency: 'low',
        reasoningSummary: 'Customer feedback shows positive product sentiment.',
        keySignals: ['positive tone'],
      },
    } as never);

    const request = createJsonRequest(
      'http://localhost/api/feedback/' + feedbackId + '/analyze-sentiment',
    );
    const response = await POST(request, createRouteParams({ id: feedbackId }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(requireAuthenticatedUser).toHaveBeenCalledOnce();
    expect(analyzeFeedbackSentiment).toHaveBeenCalledWith('user-test-1', feedbackId);
    expect(body.analysis.sentiment).toBe('positive');
  });
});
