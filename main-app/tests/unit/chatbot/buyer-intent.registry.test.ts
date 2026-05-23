import { describe, expect, it } from 'vitest';

import {
  getBuyerIntentSchemaRegistry,
  getBuyerIntentSchema,
} from '@/lib/chatbot/buyer-intent/registry';

describe('buyer intent schema registry', () => {
  it('returns the same registry instance', () => {
    const first = getBuyerIntentSchemaRegistry();
    const second = getBuyerIntentSchemaRegistry();

    expect(first).toBe(second);
  });

  it('contains the refund request schema', () => {
    const schema = getBuyerIntentSchema('REFUND_REQUEST');
    expect(schema).toBeDefined();
  });
});
