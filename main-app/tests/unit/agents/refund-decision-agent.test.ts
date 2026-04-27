import { describe, expect, it, vi } from 'vitest';

import { RefundDecisionAgent } from '@/lib/agents/refund/refund-decision-agent';
import {
  createGroqCompletionChainMock,
  invokeGroqChainMock,
  mockGroqChainSuccess,
} from '@/tests/mocks/langchain';

vi.mock('@/lib/services/ai/langchain-groq', () => ({
  createGroqCompletionChain: vi.fn(() => createGroqCompletionChainMock()),
}));

describe('RefundDecisionAgent', () => {
  it('parses structured refund recommendation output', async () => {
    mockGroqChainSuccess(
      JSON.stringify({
        recommendation: 'manual_review',
        riskScore: 0.73,
        confidenceScore: 0.88,
        reasoning: 'High-value request requires manual review.',
        signals: [{ code: 'high_value_item', weight: 0.6 }],
      }),
      'mocked-groq-model',
    );

    const agent = new RefundDecisionAgent();

    const result = await agent.run({
      task: 'refund-decision',
      payload: {
        refund: {
          refundId: 'ref-1',
          orderId: 'order-1',
          reasonCode: 'damaged',
          reasonDescription: 'Item arrived damaged with scratches',
          requestedAmount: 499.99,
          createdAt: '2026-04-27T00:00:00.000Z',
          currency: 'USD',
        },
        order: {
          status: 'delivered',
          paymentStatus: 'paid',
          totalAmount: 800,
          remainingRefundableAmount: 499.99,
        },
      },
      context: { userId: 'buyer-1' },
    });

    expect(invokeGroqChainMock).toHaveBeenCalledOnce();
    expect(result.success).toBe(true);
    expect(result.result.recommendation).toBe('manual_review');
    expect(result.result.riskScore).toBe(0.73);
    expect(result.result.confidenceScore).toBe(0.88);
    expect(result.result.modelMetadata.model).toBe('unknown');
  });

  it('returns safe manual_review fallback when output is unparseable', async () => {
    mockGroqChainSuccess('Service unavailable. Retry later.');

    const agent = new RefundDecisionAgent();

    const result = await agent.run({
      task: 'refund-decision',
      payload: {
        refund: {
          refundId: 'ref-2',
          orderId: 'order-2',
          reasonCode: 'other',
          reasonDescription: null,
          requestedAmount: 99,
          createdAt: '2026-04-27T00:00:00.000Z',
          currency: 'USD',
        },
        order: {
          status: 'completed',
          paymentStatus: 'paid',
          totalAmount: 99,
          remainingRefundableAmount: 99,
        },
      },
    });

    expect(result.success).toBe(true);
    expect(result.result.recommendation).toBe('manual_review');
    expect(result.result.modelMetadata.fallbackUsed).toBe(true);
  });
});
