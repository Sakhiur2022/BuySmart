import { describe, expect, it, vi } from 'vitest';

import { RefundDecisionAdapterService } from '@/lib/services/refund-decision-adapter.service';
import type { RefundDecisionInput } from '@/lib/agents/refund/types';

function buildInput(): RefundDecisionInput {
  return {
    refund: {
      refundId: 'ref-1',
      orderId: 'order-1',
      reasonCode: 'damaged',
      reasonDescription: 'Product was damaged on arrival',
      requestedAmount: 120,
      createdAt: '2026-04-27T00:00:00.000Z',
      currency: 'USD',
    },
    order: {
      status: 'delivered',
      paymentStatus: 'paid',
      totalAmount: 120,
      remainingRefundableAmount: 120,
    },
  };
}

describe('RefundDecisionAdapterService', () => {
  it('returns validated structured output from orchestrator dispatch', async () => {
    const orchestrator = {
      getAgent: vi.fn().mockReturnValue({}),
      register: vi.fn(),
      dispatch: vi.fn().mockResolvedValue({
        success: true,
        model: 'mocked-model',
        result: {
          schemaVersion: 'ai24.v1',
          recommendation: 'manual_review',
          riskScore: 0.54,
          confidenceScore: 0.78,
          reasoning: 'Escalate to manual review for additional verification.',
          signals: [],
          modelMetadata: {
            provider: 'groq',
            model: 'placeholder-model',
            fallbackUsed: false,
            generatedAt: '2026-04-27T00:00:00.000Z',
          },
        },
      }),
    };

    const service = new RefundDecisionAdapterService(orchestrator as never);
    const result = await service.getRefundRecommendation(buildInput(), { userId: 'buyer-1' });

    expect(orchestrator.dispatch).toHaveBeenCalledOnce();
    expect(result.recommendation).toBe('manual_review');
    expect(result.modelMetadata.model).toBe('mocked-model');
  });

  it('throws REFUND_AI_INPUT_INVALID for malformed input', async () => {
    const service = new RefundDecisionAdapterService({
      getAgent: vi.fn().mockReturnValue({}),
      register: vi.fn(),
      dispatch: vi.fn(),
    } as never);

    await expect(
      service.getRefundRecommendation({
        ...buildInput(),
        refund: {
          ...buildInput().refund,
          createdAt: 'invalid-date',
        },
      } as never),
    ).rejects.toMatchObject({
      code: 'REFUND_AI_INPUT_INVALID',
    });
  });

  it('throws REFUND_AI_OUTPUT_INVALID for malformed adapter output', async () => {
    const orchestrator = {
      getAgent: vi.fn().mockReturnValue({}),
      register: vi.fn(),
      dispatch: vi.fn().mockResolvedValue({
        success: true,
        model: 'mocked-model',
        result: {
          recommendation: 'manual_review',
          riskScore: 2,
        },
      }),
    };

    const service = new RefundDecisionAdapterService(orchestrator as never);

    await expect(service.getRefundRecommendation(buildInput())).rejects.toMatchObject({
      code: 'REFUND_AI_OUTPUT_INVALID',
    });
  });
});
