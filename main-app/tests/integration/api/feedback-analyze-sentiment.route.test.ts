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
        label: 'positive',
        sentiment: 'positive',
        score: 0.89,
        confidence: 0.89,
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
    expect(body.analysis.label).toBe('positive');
    expect(body.analysis.sentiment).toBe('positive');
    expect(body.analysis.score).toBe(0.89);
    expect(body.analysis.confidence).toBe(0.89);
  });

  it('returns 400 when feedback id is invalid', async () => {
    const request = createJsonRequest('http://localhost/api/feedback/not-a-uuid/analyze-sentiment');
    const response = await POST(request, createRouteParams({ id: 'not-a-uuid' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Validation failed');
  });

  it('returns 401 when user is not authenticated', async () => {
    const feedbackId = '84213b38-4a50-4b68-bc3d-b2ba3fdc6f5d';
    vi.mocked(requireAuthenticatedUser).mockRejectedValue(new Error('UNAUTHENTICATED'));

    const request = createJsonRequest(
      'http://localhost/api/feedback/' + feedbackId + '/analyze-sentiment',
    );
    const response = await POST(request, createRouteParams({ id: feedbackId }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toContain('Unauthorized');
  });

  it('returns 502 when analysis provider fails', async () => {
    const feedbackId = '84213b38-4a50-4b68-bc3d-b2ba3fdc6f5d';
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({ userId: 'user-test-1' });
    vi.mocked(analyzeFeedbackSentiment).mockRejectedValue(
      new Error('AI_ANALYSIS_FAILED:provider timeout'),
    );

    const request = createJsonRequest(
      'http://localhost/api/feedback/' + feedbackId + '/analyze-sentiment',
    );
    const response = await POST(request, createRouteParams({ id: feedbackId }));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toContain('provider failed');
  });

  it('returns 404 when feedback cannot be found', async () => {
    const feedbackId = '84213b38-4a50-4b68-bc3d-b2ba3fdc6f5d';
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({ userId: 'user-test-1' });
    vi.mocked(analyzeFeedbackSentiment).mockRejectedValue(new Error('Feedback not found'));

    const request = createJsonRequest(
      'http://localhost/api/feedback/' + feedbackId + '/analyze-sentiment',
    );
    const response = await POST(request, createRouteParams({ id: feedbackId }));

    expect(response.status).toBe(404);
  });

  it('returns 403 for forbidden sentiment analysis access', async () => {
    const feedbackId = '84213b38-4a50-4b68-bc3d-b2ba3fdc6f5d';
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({ userId: 'user-test-1' });
    vi.mocked(analyzeFeedbackSentiment).mockRejectedValue(new Error('FORBIDDEN'));

    const request = createJsonRequest(
      'http://localhost/api/feedback/' + feedbackId + '/analyze-sentiment',
    );
    const response = await POST(request, createRouteParams({ id: feedbackId }));

    expect(response.status).toBe(403);
  });

  it('returns 400 for invalid request message surfaced by service', async () => {
    const feedbackId = '84213b38-4a50-4b68-bc3d-b2ba3fdc6f5d';
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({ userId: 'user-test-1' });
    vi.mocked(analyzeFeedbackSentiment).mockRejectedValue(
      new Error('Feedback text is required for sentiment analysis'),
    );

    const request = createJsonRequest(
      'http://localhost/api/feedback/' + feedbackId + '/analyze-sentiment',
    );
    const response = await POST(request, createRouteParams({ id: feedbackId }));

    expect(response.status).toBe(400);
  });

  it('returns 500 for unknown runtime failures', async () => {
    const feedbackId = '84213b38-4a50-4b68-bc3d-b2ba3fdc6f5d';
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({ userId: 'user-test-1' });
    vi.mocked(analyzeFeedbackSentiment).mockRejectedValue('unknown non-error');

    const request = createJsonRequest(
      'http://localhost/api/feedback/' + feedbackId + '/analyze-sentiment',
    );
    const response = await POST(request, createRouteParams({ id: feedbackId }));

    expect(response.status).toBe(500);
  });
});
