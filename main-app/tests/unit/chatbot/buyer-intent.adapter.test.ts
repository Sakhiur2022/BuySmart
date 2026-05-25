import { describe, expect, it } from 'vitest';

import { BuyerIntentPayloadAdapter } from '@/lib/chatbot/buyer-intent/adapter';

describe('BuyerIntentPayloadAdapter', () => {
  const adapter = new BuyerIntentPayloadAdapter();

  it('requires an order id for refund submissions', () => {
    const result = adapter.toRefundRequestInput({
      reason: 'damage',
      requestedAmount: 25,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('ADAPTER_ERROR');
    }
  });

  it('maps refund reason signals to refund codes', () => {
    const result = adapter.toRefundRequestInput({
      orderSignal: { orderId: '2c1cf3c0-7e6b-4e0e-8e78-8f3d1a53a822' },
      reason: 'wrong_item',
      requestedAmount: 75,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.reason_code).toBe('wrong_item');
    }
  });

  it('builds refund order fetch input when order signal exists', () => {
    const result = adapter.toRefundOrderFetchInput({
      orderSignal: { recentOrders: true },
    });

    expect(result.success).toBe(true);
  });

  it('fails refund order fetch input when order signal is missing', () => {
    const result = adapter.toRefundOrderFetchInput({});

    expect(result.success).toBe(false);
  });

  it('requires recommendation candidates before calling the tool', () => {
    const result = adapter.toRecommendationInput({ category: 'skincare' }, { candidates: [] });

    expect(result.success).toBe(false);
  });

  it('builds a fallback intent string for recommendations', () => {
    const result = adapter.toRecommendationInput(
      { attributes: ['hydrating', 'gift'] },
      {
        candidates: [
          {
            id: 'p1',
            title: 'Glow Kit',
          },
        ],
      },
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.userIntent).toContain('hydrating');
    }
  });

  it('requires a policy question for policy QA', () => {
    const result = adapter.toPolicyQaInput({
      question: '   ',
      domain: 'returns',
      confidence: 'ambiguous',
    });

    expect(result.success).toBe(false);
  });
});
