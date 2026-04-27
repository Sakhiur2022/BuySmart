import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/app/api/cart/_shared', () => ({
  requireAuthenticatedUser: vi.fn(),
}));

vi.mock('@/lib/services/insights.service', () => ({
  getFeedbackInsightsForUser: vi.fn(),
}));

import { requireAuthenticatedUser } from '@/app/api/cart/_shared';
import { getFeedbackInsightsForUser } from '@/lib/services/insights.service';
import { GET } from '@/app/api/insights/route';

describe('GET /api/insights', () => {
  it('returns 200 with insights payload for valid request', async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({ userId: 'admin-user-1' });
    vi.mocked(getFeedbackInsightsForUser).mockResolvedValue({
      timeframe: '30d',
      scope: {
        level: 'platform',
      },
      generatedAt: '2026-04-14T00:00:00.000Z',
      totalFeedbackCount: 12,
      sentimentBreakdown: {
        totalClassified: 12,
        positive: { count: 6, percentage: 50 },
        neutral: { count: 3, percentage: 25 },
        negative: { count: 2, percentage: 16.67 },
        mixed: { count: 1, percentage: 8.33 },
      },
      averageSentimentScore: 0.29,
      perProductSummaries: [],
      highlights: {
        positive: [
          {
            feedbackId: 'a52e8265-3ea2-4af4-a741-8f91da4eb1d1',
            confidenceScore: 0.91,
            snippet: 'Great product - Quality was better than expected.',
            createdAt: '2026-04-13T00:00:00.000Z',
            productName: 'Smart Blender',
            buyerUserId: 'f0b08911-3cdf-4740-b489-16f94ebdc4e1',
            buyerName: 'Sarah Ahmed',
            buyerAvatarUrl: 'https://example.com/avatars/sarah.jpg',
          },
        ],
        negative: [],
      },
      trend: [
        {
          periodStart: '2026-04-14',
          total: 2,
          positive: 1,
          neutral: 1,
          negative: 0,
          mixed: 0,
          averageSentimentScore: 0.5,
        },
      ],
    });

    const req = new NextRequest('http://localhost/api/insights?timeframe=30d');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(getFeedbackInsightsForUser).toHaveBeenCalledWith('admin-user-1', {
      timeframe: '30d',
      sellerId: undefined,
    });
    expect(body.totalFeedbackCount).toBe(12);
  });

  it('returns 400 when query params are invalid', async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({ userId: 'admin-user-1' });

    const req = new NextRequest('http://localhost/api/insights?timeframe=90d');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Validation failed');
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(requireAuthenticatedUser).mockRejectedValue(new Error('UNAUTHENTICATED'));

    const req = new NextRequest('http://localhost/api/insights');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toContain('Unauthorized');
  });

  it('returns 403 for forbidden access', async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({ userId: 'buyer-user-1' });
    vi.mocked(getFeedbackInsightsForUser).mockRejectedValue(new Error('FORBIDDEN'));

    const req = new NextRequest('http://localhost/api/insights');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toContain('Only sellers or admins');
  });

  it('returns 500 if service returns invalid response shape', async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({ userId: 'admin-user-1' });
    vi.mocked(getFeedbackInsightsForUser).mockResolvedValue({
      timeframe: '30d',
    } as never);

    const req = new NextRequest('http://localhost/api/insights?timeframe=30d');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
