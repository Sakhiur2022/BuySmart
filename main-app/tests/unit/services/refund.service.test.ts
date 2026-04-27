import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/services/refund-decision-adapter.service', () => ({
  getRefundRecommendation: vi.fn(),
}));

import type { IRefundRepository } from '@/lib/repositories/refund.repository';
import { getRefundRecommendation } from '@/lib/services/refund-decision-adapter.service';
import {
  RefundInvalidDecisionTransitionError,
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
    vi.mocked(getRefundRecommendation).mockResolvedValue({
      schemaVersion: 'ai24.v1',
      recommendation: 'manual_review',
      riskScore: 0.5,
      confidenceScore: 0.8,
      reasoning: 'AI recommends manual review.',
      signals: [],
      modelMetadata: {
        provider: 'groq',
        model: 'test-model',
        fallbackUsed: false,
        generatedAt: '2026-04-27T00:00:00.000Z',
      },
    } as never);

    repository = {
      getUserRole: vi.fn(),
      create: vi.fn(),
      list: vi.fn(),
      findById: vi.fn(),
      findDetailById: vi.fn(),
      isSellerScopedToRefund: vi.fn(),
      getEligibilitySnapshot: vi.fn(),
      applyDecision: vi.fn(),
      saveAIAnalysis: vi.fn(),
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
    expect(repository.saveAIAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({
        refundId: 'ref-1',
        status: 'pending',
      }),
    );
  });

  it('auto-approves a refund when the AI recommendation is auto_approve', async () => {
    vi.mocked(getRefundRecommendation).mockResolvedValue({
      schemaVersion: 'ai24.v1',
      recommendation: 'auto_approve',
      riskScore: 0.12,
      confidenceScore: 0.93,
      reasoning: 'Low risk and consistent evidence.',
      signals: [],
      modelMetadata: {
        provider: 'groq',
        model: 'test-model',
        fallbackUsed: false,
        generatedAt: '2026-04-27T10:30:00.000Z',
      },
    } as never);

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
      refund_id: 'ref-2',
      refund_number: 'RFD-TEST-000002',
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
    vi.mocked(repository.saveAIAnalysis).mockResolvedValue({
      refund_id: 'ref-2',
      status: 'approved',
      processed_at: '2026-04-27T10:30:00.000Z',
      processing_notes:
        '{"decision":"auto_approve","source":"ai","note":"Automatically approved by refund AI."}',
    } as never);

    const result = await service.createRefund('buyer-1', buildCreateRefundInput());

    expect(result.status).toBe('approved');
    expect(repository.saveAIAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({
        refundId: 'ref-2',
        status: 'approved',
        processedAt: '2026-04-27T10:30:00.000Z',
      }),
    );
  });

  it('auto-rejects a refund when the AI recommendation is auto_reject', async () => {
    vi.mocked(getRefundRecommendation).mockResolvedValue({
      schemaVersion: 'ai24.v1',
      recommendation: 'auto_reject',
      riskScore: 0.91,
      confidenceScore: 0.88,
      reasoning: 'High risk and insufficient support.',
      signals: [],
      modelMetadata: {
        provider: 'groq',
        model: 'test-model',
        fallbackUsed: false,
        generatedAt: '2026-04-27T10:35:00.000Z',
      },
    } as never);

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
      refund_id: 'ref-3',
      refund_number: 'RFD-TEST-000003',
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
    vi.mocked(repository.saveAIAnalysis).mockResolvedValue({
      refund_id: 'ref-3',
      status: 'rejected',
      processed_at: '2026-04-27T10:35:00.000Z',
      processing_notes:
        '{"decision":"auto_reject","source":"ai","note":"Automatically rejected by refund AI."}',
    } as never);

    const result = await service.createRefund('buyer-1', buildCreateRefundInput());

    expect(result.status).toBe('rejected');
    expect(repository.saveAIAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({
        refundId: 'ref-3',
        status: 'rejected',
        processedAt: '2026-04-27T10:35:00.000Z',
      }),
    );
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

  it('applies buyer ownership scope when listing buyer refunds for seller-profile accounts', async () => {
    vi.mocked(repository.list).mockResolvedValue({
      refunds: [],
      pagination: {
        page: 1,
        pageSize: 5,
        totalCount: 0,
        totalPages: 0,
      },
    });

    await service.listBuyerRefunds('seller-1', {
      page: 1,
      pageSize: 5,
      sortBy: 'recent',
    });

    expect(repository.list).toHaveBeenCalledWith({
      page: 1,
      pageSize: 5,
      sortBy: 'recent',
      buyer_id: 'seller-1',
      seller_id: undefined,
    });
  });

  it('allows admin to list refunds without buyer/seller scope filters', async () => {
    vi.mocked(repository.getUserRole).mockResolvedValue('admin');
    vi.mocked(repository.list).mockResolvedValue({
      refunds: [],
      pagination: {
        page: 1,
        pageSize: 20,
        totalCount: 0,
        totalPages: 0,
      },
    });

    await service.listRefunds('admin-1', {
      page: 1,
      pageSize: 20,
      sortBy: 'recent',
    });

    expect(repository.list).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      sortBy: 'recent',
      buyer_id: undefined,
      seller_id: undefined,
    });
  });

  it('returns buyer refund detail for seller-profile accounts when they own the refund', async () => {
    vi.mocked(repository.findDetailById).mockResolvedValue({
      refund_id: 'ref-1',
      refund_number: 'RFD-TEST-000001',
      order_id: 'order-1',
      order_item_id: null,
      user_id: 'seller-1',
      buyer: {
        user_id: 'seller-1',
        full_name: 'Seller Buyer',
        email: 'seller@example.com',
      },
      seller: null,
      order: {
        order_id: 'order-1',
        order_number: 'ORD-001',
        created_at: '2026-04-19T00:00:00.000Z',
        currency: 'USD',
        total_amount: 50,
      },
      items: [],
      status: 'pending',
      reason_code: 'damaged',
      refund_type: 'full_order',
      requested_amount: 50,
      refund_amount: 50,
      created_at: '2026-04-19T00:00:00.000Z',
      updated_at: '2026-04-19T00:00:00.000Z',
      reason_description: null,
      processing_notes: null,
      ai_recommendation: null,
      ai_risk_score: null,
      ai_processed_at: null,
      ai_analysis: null,
      return_required: false,
      return_tracking: null,
      return_received_at: null,
      payment_reference: null,
      processed_by: null,
      processed_at: null,
      refunded_at: null,
    } as never);

    const result = await service.getBuyerRefundDetail('seller-1', 'ref-1');

    expect(result.refund_id).toBe('ref-1');
    expect(repository.findDetailById).toHaveBeenCalledWith('ref-1');
  });

  it('rejects refund creation for non-buyer role before eligibility lookup', async () => {
    vi.mocked(repository.getUserRole).mockResolvedValue('seller');

    await expect(service.createRefund('seller-1', buildCreateRefundInput())).rejects.toThrow(
      'FORBIDDEN',
    );
    expect(repository.getEligibilitySnapshot).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('approves refund for admin and writes processing metadata', async () => {
    vi.mocked(repository.getUserRole).mockResolvedValue('admin');
    vi.mocked(repository.findById).mockResolvedValue({
      refund_id: 'ref-1',
      status: 'pending',
    } as never);
    vi.mocked(repository.applyDecision).mockResolvedValue({
      refund_id: 'ref-1',
      status: 'approved',
      processed_by: 'admin-1',
      processed_at: '2026-04-26T00:00:00.000Z',
      processing_notes: 'notes',
    } as never);

    const result = await service.approveRefund('admin-1', 'ref-1', {
      processing_notes: 'Approved by policy',
    });

    expect(result.status).toBe('approved');
    expect(repository.applyDecision).toHaveBeenCalledTimes(1);
    expect(vi.mocked(repository.applyDecision).mock.calls[0]?.[0]).toMatchObject({
      refundId: 'ref-1',
      fromStatus: 'pending',
      toStatus: 'approved',
      processedBy: 'admin-1',
    });
  });

  it('rejects refund for non-admin actor', async () => {
    vi.mocked(repository.getUserRole).mockResolvedValue('buyer');

    await expect(
      service.rejectRefund('buyer-1', 'ref-1', {
        processing_notes: 'Not allowed',
      }),
    ).rejects.toThrow('FORBIDDEN');

    expect(repository.findById).not.toHaveBeenCalled();
    expect(repository.applyDecision).not.toHaveBeenCalled();
  });

  it('rejects invalid decision transitions', async () => {
    vi.mocked(repository.getUserRole).mockResolvedValue('admin');
    vi.mocked(repository.findById).mockResolvedValue({
      refund_id: 'ref-1',
      status: 'completed',
    } as never);

    await expect(
      service.reviewRefund('admin-1', 'ref-1', {
        processing_notes: 'Reopen request',
      }),
    ).rejects.toBeInstanceOf(RefundInvalidDecisionTransitionError);

    expect(repository.applyDecision).not.toHaveBeenCalled();
  });

  it('throws conflict when decision write loses status race', async () => {
    vi.mocked(repository.getUserRole).mockResolvedValue('admin');
    vi.mocked(repository.findById).mockResolvedValue({
      refund_id: 'ref-1',
      status: 'pending',
    } as never);
    vi.mocked(repository.applyDecision).mockResolvedValue(null);

    await expect(
      service.approveRefund('admin-1', 'ref-1', {
        processing_notes: 'Approve',
      }),
    ).rejects.toThrow('REFUND_CONFLICT');
  });
});
