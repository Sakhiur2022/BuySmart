import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/services/refund.service', () => ({
  createRefundForUser: vi.fn(),
  getRefundDetailForUser: vi.fn(),
  listRefundsForUser: vi.fn(),
}));

import {
  createRefundForUser,
  getRefundDetailForUser,
  listRefundsForUser,
} from '@/lib/services/refund.service';
import { createRefund, getRefundById, listRefunds } from '@/lib/controllers/refund.controller';

describe('refund controller delegation', () => {
  it('delegates createRefund to createRefundForUser with unchanged args', async () => {
    const input = {
      order_id: '03f14e69-cd59-44a8-b63d-f2f59ab9f62e',
      refund_type: 'full_order',
      reason_code: 'damaged',
      requested_amount: 42,
      return_required: false,
      currency: 'USD',
    } as const;

    vi.mocked(createRefundForUser).mockResolvedValue({ refund_id: 'ref-1' } as never);

    const result = await createRefund('buyer-1', input as never);

    expect(createRefundForUser).toHaveBeenCalledWith('buyer-1', input);
    expect(result).toEqual({ refund_id: 'ref-1' });
  });

  it('delegates listRefunds to listRefundsForUser with unchanged args', async () => {
    const filters = {
      page: 1,
      pageSize: 20,
      sortBy: 'recent',
      status: 'pending',
    } as const;

    vi.mocked(listRefundsForUser).mockResolvedValue({
      refunds: [],
      pagination: { page: 1, pageSize: 20, totalCount: 0, totalPages: 0 },
    } as never);

    const result = await listRefunds('buyer-1', filters as never);

    expect(listRefundsForUser).toHaveBeenCalledWith('buyer-1', filters);
    expect(result.pagination.totalCount).toBe(0);
  });

  it('delegates getRefundById to getRefundDetailForUser with unchanged args', async () => {
    vi.mocked(getRefundDetailForUser).mockResolvedValue({ refund_id: 'ref-2' } as never);

    const result = await getRefundById('buyer-1', 'ref-2');

    expect(getRefundDetailForUser).toHaveBeenCalledWith('buyer-1', 'ref-2');
    expect(result).toEqual({ refund_id: 'ref-2' });
  });

  it('propagates service rejections unchanged', async () => {
    vi.mocked(createRefundForUser).mockRejectedValue(new Error('FORBIDDEN'));

    await expect(
      createRefund('seller-1', {
        order_id: '03f14e69-cd59-44a8-b63d-f2f59ab9f62e',
        refund_type: 'full_order',
        reason_code: 'damaged',
        requested_amount: 42,
        return_required: false,
        currency: 'USD',
      } as never),
    ).rejects.toThrow('FORBIDDEN');
  });
});
