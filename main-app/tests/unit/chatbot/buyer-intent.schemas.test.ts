import { describe, expect, it } from 'vitest';

import {
  policyQaPayloadSchema,
  productRecommendationPayloadSchema,
  refundRequestPayloadSchema,
} from '@/lib/chatbot/buyer-intent/schemas';

describe('buyer intent schemas', () => {
  it('accepts partial refund request payloads', () => {
    const parsed = refundRequestPayloadSchema.safeParse({
      reason: 'damage',
      orderSignal: {
        recentOrders: true,
      },
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects invalid recommendation budget ranges', () => {
    const parsed = productRecommendationPayloadSchema.safeParse({
      budget: { min: 200, max: 100, currency: 'USD' },
    });

    expect(parsed.success).toBe(false);
  });

  it('requires a policy question string', () => {
    const parsed = policyQaPayloadSchema.safeParse({
      domain: 'returns',
      confidence: 'certain',
    });

    expect(parsed.success).toBe(false);
  });
});
