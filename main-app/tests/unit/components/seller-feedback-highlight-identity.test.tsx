/** @vitest-environment jsdom */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SellerFeedbackHighlightIdentity } from '@/components/seller/seller-feedback-highlight-identity';
import type { FeedbackHighlight } from '@/lib/types/insights.types';

const baseHighlight: FeedbackHighlight = {
  feedbackId: 'cb31f7ef-e5ea-4f80-8fc1-b239ee80f6f4',
  confidenceScore: 0.8,
  snippet: 'Packaging was damaged',
  createdAt: '2026-04-15T00:00:00.000Z',
  productName: 'Noise Cancelling Headphones',
  buyerUserId: 'f0b08911-3cdf-4740-b489-16f94ebdc4e1',
  buyerName: 'Nadia Karim',
  buyerAvatarUrl: 'https://example.com/avatars/nadia.jpg',
};

describe('SellerFeedbackHighlightIdentity', () => {
  it('renders populated buyer and product context', () => {
    render(<SellerFeedbackHighlightIdentity highlight={baseHighlight} />);

    expect(screen.getByText('Nadia Karim')).toBeInTheDocument();
    expect(screen.getByText('Noise Cancelling Headphones')).toBeInTheDocument();
  });

  it('renders fallback labels when buyer and product values are missing', () => {
    render(
      <SellerFeedbackHighlightIdentity
        highlight={{
          ...baseHighlight,
          buyerName: null,
          buyerAvatarUrl: null,
          productName: null,
        }}
      />,
    );

    expect(screen.getByText('Anonymous buyer')).toBeInTheDocument();
    expect(screen.getByText('Product unavailable')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });
});
