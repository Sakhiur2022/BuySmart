import { describe, expect, it } from 'vitest';

import { BuyerIntentToolFactory } from '@/lib/chatbot/buyer-intent/tool-factory';
import type { BuyerIntentType } from '@/lib/chatbot/buyer-intent/types';

describe('BuyerIntentToolFactory', () => {
  it('returns a tool for refund requests', () => {
    const factory = new BuyerIntentToolFactory();
    const result = factory.getTool('REFUND_REQUEST');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.name).toBe('refund_request');
    }
  });

  it('returns an error for unknown intents', () => {
    const factory = new BuyerIntentToolFactory();
    const result = factory.getTool('UNKNOWN' as BuyerIntentType);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('TOOL_NOT_FOUND');
    }
  });
});
