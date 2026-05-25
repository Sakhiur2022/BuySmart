import { describe, expect, it } from 'vitest';

import { mapRefundToolError } from '@/lib/services/refund-tools/error-map';
import { RefundInvalidAmountError } from '@/lib/services/refund.service';

describe('Refund tool error map', () => {
  it('maps invalid amount errors to business errors', () => {
    const error = new RefundInvalidAmountError('Invalid amount');
    const mapped = mapRefundToolError(error);

    expect(mapped.code).toBe('REFUND_INVALID_AMOUNT');
    expect(mapped.details?.kind).toBe('business');
  });

  it('maps timeout errors to infrastructure errors', () => {
    const mapped = mapRefundToolError(new Error('Request timeout'));

    expect(mapped.code).toBe('REFUND_TIMEOUT');
    expect(mapped.details?.kind).toBe('infrastructure');
    expect(mapped.details?.mascotTrigger).toBe(true);
  });
});
