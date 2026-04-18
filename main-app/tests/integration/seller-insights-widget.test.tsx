/** @vitest-environment jsdom */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SellerInsightsWidget } from '@/components/seller/seller-insights-widget';
import type { FeedbackInsightsResponse } from '@/lib/types/insights.types';

const baseInsights: FeedbackInsightsResponse = {
  timeframe: '30d',
  scope: {
    level: 'seller',
    sellerId: '11111111-1111-1111-1111-111111111111',
  },
  generatedAt: '2026-04-18T00:00:00.000Z',
  totalFeedbackCount: 12,
  sentimentBreakdown: {
    totalClassified: 10,
    positive: { count: 6, percentage: 60 },
    neutral: { count: 2, percentage: 20 },
    negative: { count: 1, percentage: 10 },
    mixed: { count: 1, percentage: 10 },
  },
  averageSentimentScore: 0.44,
  perProductSummaries: [
    {
      productId: '22222222-2222-2222-2222-222222222222',
      productName: 'Smart Blender',
      totalClassified: 10,
      sentimentBreakdown: {
        positive: { count: 6, percentage: 60 },
        neutral: { count: 2, percentage: 20 },
        negative: { count: 1, percentage: 10 },
        mixed: { count: 1, percentage: 10 },
      },
      averageSentimentScore: 0.44,
    },
  ],
  highlights: {
    positive: [
      {
        feedbackId: '33333333-3333-3333-3333-333333333333',
        confidenceScore: 0.91,
        snippet: 'Great quality and fast delivery',
        createdAt: '2026-04-16T00:00:00.000Z',
      },
    ],
    negative: [
      {
        feedbackId: '44444444-4444-4444-4444-444444444444',
        confidenceScore: 0.8,
        snippet: 'Packaging was damaged',
        createdAt: '2026-04-15T00:00:00.000Z',
      },
    ],
  },
  trend: [],
};

describe('SellerInsightsWidget', () => {
  it('renders insights summary and highlights for populated data', () => {
    render(<SellerInsightsWidget feedbackInsights={baseInsights} feedbackInsightsError={null} />);

    expect(screen.getByText('Sentiment Summary')).toBeInTheDocument();
    expect(screen.getByText('Top Feedback')).toBeInTheDocument();
    expect(screen.getByText('Feedback Volume')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Great quality and fast delivery')).toBeInTheDocument();
    expect(screen.getByText('Packaging was damaged')).toBeInTheDocument();
  });

  it('renders empty-state content when insights are unavailable', () => {
    render(<SellerInsightsWidget feedbackInsights={null} feedbackInsightsError={null} />);

    expect(
      screen.getByText('No feedback insights yet. Check back once customers leave reviews.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Top feedback will appear once sentiment analysis completes.'),
    ).toBeInTheDocument();
  });

  it('renders API error state when insights fetch fails', () => {
    render(
      <SellerInsightsWidget
        feedbackInsights={null}
        feedbackInsightsError="Unable to load feedback insights."
      />,
    );

    expect(screen.getByText('Unable to load feedback insights.')).toBeInTheDocument();
  });
});
