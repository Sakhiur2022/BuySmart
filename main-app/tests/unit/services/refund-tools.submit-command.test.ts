import { describe, expect, it } from 'vitest';

import { RefundSubmitCommandBuilder } from '@/lib/services/refund-tools/refund-submit-command-builder';

const baseInput = {
  order_id: 'd1c4e1d8-4e20-4cd9-9d70-2e70c2ed11c1',
  refund_type: 'full_order',
  reason_code: 'damaged',
  requested_amount: 20,
  return_required: false,
};

describe('RefundSubmitCommandBuilder', () => {
  it('builds a command when required fields are present', () => {
    const builder = new RefundSubmitCommandBuilder();
    const result = builder.build(baseInput as Parameters<typeof builder.build>[0]);

    expect(result.order_id).toBe(baseInput.order_id);
  });

  it('throws when order id is missing', () => {
    const builder = new RefundSubmitCommandBuilder();
    expect(() =>
      builder.build({
        ...baseInput,
        order_id: '',
      } as Parameters<typeof builder.build>[0]),
    ).toThrow();
  });

  it('throws when refund amount is missing', () => {
    const builder = new RefundSubmitCommandBuilder();
    expect(() =>
      builder.build({
        ...baseInput,
        requested_amount: NaN,
      } as Parameters<typeof builder.build>[0]),
    ).toThrow();
  });
});
