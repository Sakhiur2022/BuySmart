import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/repositories/feedback.repository', () => ({
  fetchUserRole: vi.fn(),
  countPublishedFeedbackForInsights: vi.fn(),
  fetchProcessedFeedbackForInsights: vi.fn(),
}));

import {
  countPublishedFeedbackForInsights,
  fetchProcessedFeedbackForInsights,
  fetchUserRole,
} from '@/lib/repositories/feedback.repository';
import { getFeedbackInsightsForUser } from '@/lib/services/insights.service';

describe('getFeedbackInsightsForUser', () => {
  it('returns platform scope insights for admin user', async () => {
    vi.mocked(fetchUserRole).mockResolvedValue('admin');
    vi.mocked(countPublishedFeedbackForInsights).mockResolvedValue(5);
    vi.mocked(fetchProcessedFeedbackForInsights).mockResolvedValue([
      {
        feedback_id: 'a52e8265-3ea2-4af4-a741-8f91da4eb1d1',
        title: 'Excellent',
        comment: 'Loved it',
        created_at: '2026-04-14T00:00:00.000Z',
        product_id: '3c7a7627-67f6-4b9f-9b1a-f6c6e28782ad',
        product_name: 'Smart Blender',
        buyer_user_id: 'f0b08911-3cdf-4740-b489-16f94ebdc4e1',
        buyer_full_name: 'Sarah Ahmed',
        buyer_display_name: null,
        buyer_avatar_url: 'https://example.com/avatars/sarah.jpg',
        ai_sentiment: 'positive',
        ai_confidence_score: 0.9,
      },
      {
        feedback_id: 'd7b319f4-cf69-4d14-8eb3-54a4dc29f4ad',
        title: 'Average',
        comment: 'It is okay',
        created_at: '2026-04-14T01:00:00.000Z',
        product_id: '3c7a7627-67f6-4b9f-9b1a-f6c6e28782ad',
        product_name: 'Smart Blender',
        buyer_user_id: '2accbe7b-f061-44fc-b6c1-12d08e55ece8',
        buyer_full_name: 'Karim Rahman',
        buyer_display_name: 'Karim',
        buyer_avatar_url: null,
        ai_sentiment: 'neutral',
        ai_confidence_score: 0.4,
      },
      {
        feedback_id: '2a85f446-f4da-4ab1-a266-887962eef8f2',
        title: 'Not good',
        comment: 'Bad quality',
        created_at: '2026-04-14T02:00:00.000Z',
        product_id: '8f4a72f7-7c81-4047-87f0-c2744f2abfd5',
        product_name: 'Noise Cancelling Headphones',
        buyer_user_id: '95396d02-528f-4134-8e7f-879e3e0538f6',
        buyer_full_name: 'Nadia Karim',
        buyer_display_name: null,
        buyer_avatar_url: null,
        ai_sentiment: 'negative',
        ai_confidence_score: 0.8,
      },
    ] as never);

    const result = await getFeedbackInsightsForUser('admin-user-1', {
      timeframe: '30d',
      sellerId: undefined,
    });

    expect(result.scope.level).toBe('platform');
    expect(result.totalFeedbackCount).toBe(5);
    expect(result.sentimentBreakdown.totalClassified).toBe(3);
    expect(result.sentimentBreakdown.positive.count).toBe(1);
    expect(result.sentimentBreakdown.neutral.count).toBe(1);
    expect(result.sentimentBreakdown.negative.count).toBe(1);
    expect(result.averageSentimentScore).toBeCloseTo(0.033, 3);
    expect(result.perProductSummaries.length).toBe(2);
    expect(result.highlights.positive.length).toBeGreaterThanOrEqual(1);
    expect(result.highlights.negative.length).toBeGreaterThanOrEqual(1);
    expect(result.highlights.positive[0]?.buyerName).toBe('Sarah Ahmed');
    expect(result.highlights.positive[0]?.productName).toBe('Smart Blender');
    expect(result.trend.length).toBe(30);
  });

  it('forces seller scope to authenticated seller id', async () => {
    vi.mocked(fetchUserRole).mockResolvedValue('seller');
    vi.mocked(countPublishedFeedbackForInsights).mockResolvedValue(0);
    vi.mocked(fetchProcessedFeedbackForInsights).mockResolvedValue([]);

    await getFeedbackInsightsForUser('seller-user-1', {
      timeframe: '7d',
      sellerId: undefined,
    });

    expect(countPublishedFeedbackForInsights).toHaveBeenCalledWith(
      expect.objectContaining({ sellerId: 'seller-user-1' }),
    );
    expect(fetchProcessedFeedbackForInsights).toHaveBeenCalledWith(
      expect.objectContaining({ sellerId: 'seller-user-1' }),
    );
  });

  it('rejects seller requesting another seller id', async () => {
    vi.mocked(fetchUserRole).mockResolvedValue('seller');

    await expect(
      getFeedbackInsightsForUser('seller-user-1', {
        timeframe: '30d',
        sellerId: 'other-seller-id',
      }),
    ).rejects.toThrow('FORBIDDEN');
  });

  it('rejects buyer role', async () => {
    vi.mocked(fetchUserRole).mockResolvedValue('buyer');

    await expect(
      getFeedbackInsightsForUser('buyer-user-1', {
        timeframe: '30d',
        sellerId: undefined,
      }),
    ).rejects.toThrow('FORBIDDEN');
  });

  it('returns monthly trend points for all-time timeframe', async () => {
    vi.mocked(fetchUserRole).mockResolvedValue('admin');
    vi.mocked(countPublishedFeedbackForInsights).mockResolvedValue(2);
    vi.mocked(fetchProcessedFeedbackForInsights).mockResolvedValue([
      {
        feedback_id: 'a52e8265-3ea2-4af4-a741-8f91da4eb1d1',
        title: null,
        comment: 'Historic feedback',
        created_at: '2026-01-12T00:00:00.000Z',
        product_id: '3c7a7627-67f6-4b9f-9b1a-f6c6e28782ad',
        product_name: 'Smart Blender',
        buyer_user_id: 'f0b08911-3cdf-4740-b489-16f94ebdc4e1',
        buyer_full_name: 'Sarah Ahmed',
        buyer_display_name: null,
        buyer_avatar_url: null,
        ai_sentiment: 'mixed',
        ai_confidence_score: 0.5,
      },
      {
        feedback_id: 'd7b319f4-cf69-4d14-8eb3-54a4dc29f4ad',
        title: null,
        comment: 'Recent feedback',
        created_at: '2026-04-01T00:00:00.000Z',
        product_id: '3c7a7627-67f6-4b9f-9b1a-f6c6e28782ad',
        product_name: 'Smart Blender',
        buyer_user_id: '2accbe7b-f061-44fc-b6c1-12d08e55ece8',
        buyer_full_name: 'Karim Rahman',
        buyer_display_name: 'Karim',
        buyer_avatar_url: null,
        ai_sentiment: 'positive',
        ai_confidence_score: 0.7,
      },
    ] as never);

    const result = await getFeedbackInsightsForUser('admin-user-1', {
      timeframe: 'all',
      sellerId: undefined,
    });

    expect(result.trend.length).toBeGreaterThanOrEqual(4);
    expect(result.trend.some((point) => point.periodStart === '2026-01')).toBe(true);
    expect(result.trend.some((point) => point.periodStart === '2026-04')).toBe(true);
  });
});
