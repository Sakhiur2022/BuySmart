import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IRefundRepository } from '@/lib/repositories/refund.repository';
import {
  RefundIneligibleStatusError,
  RefundInvalidAmountError,
  RefundService,
} from '@/lib/services/refund.service';
import type { CreateRefundDTO } from '@/lib/types/refund.types';

function buildCreateRefundInput(): CreateRefundDTO {
  return {
    order_id: '0f0ccfd0-f02d-4d3e-b0d0-3b15f2916ff1',
    order_item_id: null,
    refund_type: 'full_order',
    reason_code: 'damaged',
    requested_amount: 50,
    return_required: false,
    currency: 'USD',
  };
}

describe('refund.service eligibility', () => {
  let repository: IRefundRepository;
  let service: RefundService;

  beforeEach(() => {
    repository = {
      create: vi.fn(),
      list: vi.fn(),
      findById: vi.fn(),
      findDetailById: vi.fn(),
      getEligibilitySnapshot: vi.fn(),
    };

    service = new RefundService(repository);
  });

  it('rejects refund creation when order status is not delivered/completed', async () => {
    vi.mocked(repository.getEligibilitySnapshot).mockResolvedValue({
      order_id: '0f0ccfd0-f02d-4d3e-b0d0-3b15f2916ff1',
      buyer_id: 'buyer-1',
      order_status: 'processing',
      order_total_amount: 120,
      processed_refund_total: 0,
      remaining_refundable_amount: 120,
      currency: 'USD',
    });

    await expect(service.createRefund('buyer-1', buildCreateRefundInput())).rejects.toBeInstanceOf(
      RefundIneligibleStatusError,
    );
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects refund creation when requested amount is zero', async () => {
    const input = buildCreateRefundInput();
    input.requested_amount = 0;

    await expect(service.createRefund('buyer-1', input)).rejects.toBeInstanceOf(
      RefundInvalidAmountError,
    );
    expect(repository.getEligibilitySnapshot).not.toHaveBeenCalled();
  });

  it('rejects refund creation when requested amount exceeds remaining refundable balance', async () => {
    vi.mocked(repository.getEligibilitySnapshot).mockResolvedValue({
      order_id: '0f0ccfd0-f02d-4d3e-b0d0-3b15f2916ff1',
      buyer_id: 'buyer-1',
      order_status: 'completed',
      order_total_amount: 120,
      processed_refund_total: 90,
      remaining_refundable_amount: 30,
      currency: 'USD',
    });

    await expect(service.createRefund('buyer-1', buildCreateRefundInput())).rejects.toBeInstanceOf(
      RefundInvalidAmountError,
    );
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('creates refund when status and amount are eligible', async () => {
    vi.mocked(repository.getEligibilitySnapshot).mockResolvedValue({
      order_id: '0f0ccfd0-f02d-4d3e-b0d0-3b15f2916ff1',
      buyer_id: 'buyer-1',
      order_status: 'delivered',
      order_total_amount: 120,
      processed_refund_total: 20,
      remaining_refundable_amount: 100,
      currency: 'USD',
    });

    vi.mocked(repository.create).mockResolvedValue({
      refund_id: 'ref-1',
      refund_number: 'RFD-TEST-000001',
      order_id: '0f0ccfd0-f02d-4d3e-b0d0-3b15f2916ff1',
      order_item_id: null,
      user_id: 'buyer-1',
      status: 'pending',
      reason_code: 'damaged',
      refund_type: 'full_order',
      requested_amount: 50,
      refund_amount: 50,
      created_at: '2026-04-19T00:00:00.000Z',
      updated_at: '2026-04-19T00:00:00.000Z',
      reason_description: null,
      return_required: false,
      return_tracking: null,
      return_received_at: null,
      payment_reference: null,
      processed_by: null,
      processed_at: null,
      processing_notes: null,
      refunded_at: null,
      ai_recommendation: null,
      ai_risk_score: null,
      ai_processed_at: null,
      evidence_images: [],
      items: [],
    });

    const result = await service.createRefund('buyer-1', buildCreateRefundInput());

    expect(result.refund_id).toBe('ref-1');
    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(vi.mocked(repository.create).mock.calls[0]?.[0]).toMatchObject({
      user_id: 'buyer-1',
      order_id: '0f0ccfd0-f02d-4d3e-b0d0-3b15f2916ff1',
      requested_amount: 50,
    });
    expect(vi.mocked(repository.create).mock.calls[0]?.[0].refund_number).toMatch(/^RFD-/);
  });
});
