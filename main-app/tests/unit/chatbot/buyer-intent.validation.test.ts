import { describe, expect, it } from 'vitest';

import { validateBuyerIntentOutput } from '@/lib/chatbot/buyer-intent/validation';

describe('validateBuyerIntentOutput', () => {
  it('returns an error for invalid JSON', () => {
    const result = validateBuyerIntentOutput('{not-json');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_JSON');
    }
  });

  it('returns an error for unknown intent types', () => {
    const result = validateBuyerIntentOutput({
      intent: 'SOMETHING_ELSE',
      payload: {},
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('UNKNOWN_INTENT');
    }
  });

  it('validates a refund request payload', () => {
    const result = validateBuyerIntentOutput({
      intent: 'REFUND_REQUEST',
      payload: {
        reason: 'damage',
        orderSignal: { recentOrders: true },
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.intent).toBe('REFUND_REQUEST');
    }
  });

  it('returns payload errors for invalid policy QA', () => {
    const result = validateBuyerIntentOutput({
      intent: 'POLICY_QA',
      payload: {
        domain: 'returns',
        confidence: 'certain',
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_PAYLOAD');
    }
  });
});
