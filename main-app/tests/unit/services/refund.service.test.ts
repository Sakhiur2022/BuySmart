import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IRefundRepository } from '@/lib/repositories/refund.repository';
import {
  RefundIneligibleStatusError,
  RefundInvalidAmountError,
  RefundService,
} from '@/lib/services/refund.service';
import type { CreateRefundDTO, RefundDetailDTO } from '@/lib/types/refund.types';

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

function buildRefundDetail(overrides: Partial<RefundDetailDTO> = {}): RefundDetailDTO {
  return {
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
    buyer: { user_id: 'buyer-1', full_name: 'Buyer One', email: null },
    seller: { user_id: 'seller-1', full_name: 'Seller One', email: null },
    order: {
      order_id: '0f0ccfd0-f02d-4d3e-b0d0-3b15f2916ff1',
      order_number: 'ORD-001',
      created_at: '2026-04-18T00:00:00.000Z',
      currency: 'USD',
      total_amount: 50,
    },
    items: [],
    reason_description: null,
    processing_notes: null,
    ai_recommendation: null,
    ai_risk_score: null,
    ai_processed_at: null,
    processed_at: null,
    return_required: false,
    return_tracking: null,
    return_received_at: null,
    payment_reference: null,
    refunded_at: null,
    ...overrides,
  };
}

describe('refund.service eligibility', () => {
  let repository: IRefundRepository;
  let service: RefundService;

  beforeEach(() => {
    repository = {
      getUserRole: vi.fn(),
      create: vi.fn(),
      list: vi.fn(),
      findById: vi.fn(),
      findDetailById: vi.fn(),
      isSellerScopedToRefund: vi.fn(),
      getEligibilitySnapshot: vi.fn(),
    };

    service = new RefundService(repository);
  });

  it('rejects refund creation when order status is not delivered/completed', async () => {
    vi.mocked(repository.getUserRole).mockResolvedValue('buyer');
    vi.mocked(repository.getEligibilitySnapshot).mockResolvedValue({
      order_id: '0f0ccfd0-f02d-4d3e-b0d0-3b15f2916ff1',
      buyer_id: 'buyer-1',
      order_status: 'processing',
      payment_status: 'pending',
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
    vi.mocked(repository.getUserRole).mockResolvedValue('buyer');
    const input = buildCreateRefundInput();
    input.requested_amount = 0;

    await expect(service.createRefund('buyer-1', input)).rejects.toBeInstanceOf(
      RefundInvalidAmountError,
    );
    expect(repository.getEligibilitySnapshot).not.toHaveBeenCalled();
  });

  it('rejects refund creation when requested amount exceeds remaining refundable balance', async () => {
    vi.mocked(repository.getUserRole).mockResolvedValue('buyer');
    vi.mocked(repository.getEligibilitySnapshot).mockResolvedValue({
      order_id: '0f0ccfd0-f02d-4d3e-b0d0-3b15f2916ff1',
      buyer_id: 'buyer-1',
      order_status: 'completed',
      payment_status: 'paid',
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

  it('rejects refund creation when payment status is not paid', async () => {
    vi.mocked(repository.getUserRole).mockResolvedValue('buyer');
    vi.mocked(repository.getEligibilitySnapshot).mockResolvedValue({
      order_id: '0f0ccfd0-f02d-4d3e-b0d0-3b15f2916ff1',
      buyer_id: 'buyer-1',
      order_status: 'delivered',
      payment_status: 'pending',
      order_total_amount: 120,
      processed_refund_total: 20,
      remaining_refundable_amount: 100,
      currency: 'USD',
    });

    await expect(service.createRefund('buyer-1', buildCreateRefundInput())).rejects.toMatchObject({
      code: 'REFUND_INELIGIBLE_PAYMENT_STATUS',
    });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('creates refund when status and amount are eligible', async () => {
    vi.mocked(repository.getUserRole).mockResolvedValue('buyer');
    vi.mocked(repository.getEligibilitySnapshot).mockResolvedValue({
      order_id: '0f0ccfd0-f02d-4d3e-b0d0-3b15f2916ff1',
      buyer_id: 'buyer-1',
      order_status: 'delivered',
      payment_status: 'paid',
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
    } as never);

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

  it('applies buyer scope when listing refunds for buyer role', async () => {
    vi.mocked(repository.getUserRole).mockResolvedValue('buyer');
    vi.mocked(repository.list).mockResolvedValue({
      refunds: [],
      pagination: {
        page: 2,
        pageSize: 10,
        totalCount: 0,
        totalPages: 0,
      },
    });

    await service.listRefunds('buyer-1', {
      page: 2,
      pageSize: 10,
      sortBy: 'recent',
    });

    expect(repository.list).toHaveBeenCalledWith({
      page: 2,
      pageSize: 10,
      sortBy: 'recent',
      buyer_id: 'buyer-1',
      seller_id: undefined,
    });
  });

  it('applies seller scope when listing refunds for seller role', async () => {
    vi.mocked(repository.getUserRole).mockResolvedValue('seller');
    vi.mocked(repository.list).mockResolvedValue({
      refunds: [],
      pagination: {
        page: 1,
        pageSize: 20,
        totalCount: 0,
        totalPages: 0,
      },
    });

    await service.listRefunds('seller-1', {
      page: 1,
      pageSize: 20,
      sortBy: 'recent',
    });

    expect(repository.list).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      sortBy: 'recent',
      buyer_id: undefined,
      seller_id: 'seller-1',
    });
  });

  it('rejects list refunds for unsupported role', async () => {
    vi.mocked(repository.getUserRole).mockResolvedValue('admin');

    await expect(
      service.listRefunds('admin-1', {
        page: 1,
        pageSize: 20,
        sortBy: 'recent',
      }),
    ).rejects.toThrow('FORBIDDEN');
    expect(repository.list).not.toHaveBeenCalled();
  });

  it('rejects refund creation for non-buyer role before eligibility lookup', async () => {
    vi.mocked(repository.getUserRole).mockResolvedValue('seller');

    await expect(service.createRefund('seller-1', buildCreateRefundInput())).rejects.toThrow(
      'FORBIDDEN',
    );
    expect(repository.getEligibilitySnapshot).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('returns refund detail for buyer in scope', async () => {
    vi.mocked(repository.getUserRole).mockResolvedValue('buyer');
    vi.mocked(repository.findDetailById).mockResolvedValue(buildRefundDetail());

    const result = await service.getRefundDetail('buyer-1', 'ref-1');

    expect(result.refund_id).toBe('ref-1');
    expect(repository.isSellerScopedToRefund).not.toHaveBeenCalled();
  });

  it('rejects refund detail for buyer out of scope', async () => {
    vi.mocked(repository.getUserRole).mockResolvedValue('buyer');
    vi.mocked(repository.findDetailById).mockResolvedValue(
      buildRefundDetail({ user_id: 'buyer-2' }),
    );

    await expect(service.getRefundDetail('buyer-1', 'ref-1')).rejects.toThrow('FORBIDDEN');
    expect(repository.isSellerScopedToRefund).not.toHaveBeenCalled();
  });

  it('returns refund detail for seller in scope', async () => {
    vi.mocked(repository.getUserRole).mockResolvedValue('seller');
    vi.mocked(repository.findDetailById).mockResolvedValue(buildRefundDetail());
    vi.mocked(repository.isSellerScopedToRefund).mockResolvedValue(true);

    const result = await service.getRefundDetail('seller-1', 'ref-1');

    expect(result.refund_id).toBe('ref-1');
    expect(repository.isSellerScopedToRefund).toHaveBeenCalledWith('ref-1', 'seller-1');
  });

  it('rejects refund detail for seller out of scope', async () => {
    vi.mocked(repository.getUserRole).mockResolvedValue('seller');
    vi.mocked(repository.findDetailById).mockResolvedValue(buildRefundDetail());
    vi.mocked(repository.isSellerScopedToRefund).mockResolvedValue(false);

    await expect(service.getRefundDetail('seller-1', 'ref-1')).rejects.toThrow('FORBIDDEN');
  });

  it('rejects refund detail when refund is missing', async () => {
    vi.mocked(repository.getUserRole).mockResolvedValue('buyer');
    vi.mocked(repository.findDetailById).mockResolvedValue(null);

    await expect(service.getRefundDetail('buyer-1', 'ref-1')).rejects.toThrow('Refund not found');
  });

  it('rejects refund detail for unsupported role', async () => {
    vi.mocked(repository.getUserRole).mockResolvedValue('admin');
    vi.mocked(repository.findDetailById).mockResolvedValue(buildRefundDetail());

    await expect(service.getRefundDetail('admin-1', 'ref-1')).rejects.toThrow('FORBIDDEN');
    expect(repository.findDetailById).toHaveBeenCalledWith('ref-1');
  });
});
