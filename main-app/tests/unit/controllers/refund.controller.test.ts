import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/services/refund.service', () => ({
  approveRefundForAdmin: vi.fn(),
  createRefundForUser: vi.fn(),
  getRefundDetailForUser: vi.fn(),
  listRefundsForUser: vi.fn(),
  rejectRefundForAdmin: vi.fn(),
  reviewRefundForAdmin: vi.fn(),
}));

import {
  approveRefundForAdmin,
  createRefundForUser,
  getRefundDetailForUser,
  listRefundsForUser,
  rejectRefundForAdmin,
  reviewRefundForAdmin,
} from '@/lib/services/refund.service';
import {
  approveRefund,
  createRefund,
  getRefundById,
  listRefunds,
  rejectRefund,
  reviewRefund,
} from '@/lib/controllers/refund.controller';

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

  it('delegates approveRefund to approveRefundForAdmin with unchanged args', async () => {
    vi.mocked(approveRefundForAdmin).mockResolvedValue({ refund_id: 'ref-approve' } as never);

    const result = await approveRefund('admin-1', 'ref-1', {
      processing_notes: 'Looks good',
    });

    expect(approveRefundForAdmin).toHaveBeenCalledWith('admin-1', 'ref-1', {
      processing_notes: 'Looks good',
    });
    expect(result).toEqual({ refund_id: 'ref-approve' });
  });

  it('delegates rejectRefund to rejectRefundForAdmin with unchanged args', async () => {
    vi.mocked(rejectRefundForAdmin).mockResolvedValue({ refund_id: 'ref-reject' } as never);

    const result = await rejectRefund('admin-1', 'ref-1', {
      processing_notes: 'Evidence mismatch',
    });

    expect(rejectRefundForAdmin).toHaveBeenCalledWith('admin-1', 'ref-1', {
      processing_notes: 'Evidence mismatch',
    });
    expect(result).toEqual({ refund_id: 'ref-reject' });
  });

  it('delegates reviewRefund to reviewRefundForAdmin with unchanged args', async () => {
    vi.mocked(reviewRefundForAdmin).mockResolvedValue({ refund_id: 'ref-review' } as never);

    const result = await reviewRefund('admin-1', 'ref-1', {
      processing_notes: 'Need manual check',
    });

    expect(reviewRefundForAdmin).toHaveBeenCalledWith('admin-1', 'ref-1', {
      processing_notes: 'Need manual check',
    });
    expect(result).toEqual({ refund_id: 'ref-review' });
  });
});
