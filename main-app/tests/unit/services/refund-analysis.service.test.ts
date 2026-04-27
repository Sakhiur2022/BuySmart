import { describe, expect, it } from 'vitest';

import { analyzeRefundHeuristically } from '@/lib/services/refund-analysis.service';

describe('analyzeRefundHeuristically', () => {
  it('does not auto-approve a refund when the buyer admits the item was already consumed', () => {
    const result = analyzeRefundHeuristically({
      reasonCode: 'damaged',
      reasonDescription: 'I already finished my Maxim Coffee, but can I still get a refund?',
      requestedAmount: 66,
    });

    expect(result.recommendation).toBe('auto_reject');
    expect(result.factors).toContain('item_already_consumed_or_used');
  });

  it('raises risk for buyer-remorse language', () => {
    const result = analyzeRefundHeuristically({
      reasonCode: 'changed_mind',
      reasonDescription: "I don't want this anymore",
      requestedAmount: 9000,
    });

    expect(result.recommendation).not.toBe('auto_approve');
    expect(result.factors).toContain('buyer_remorse_signal');
  });
});
