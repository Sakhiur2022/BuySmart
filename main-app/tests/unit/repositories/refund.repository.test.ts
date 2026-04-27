import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import { RefundRepository } from '@/lib/repositories/refundRepository';

type QueryResponse<T> = {
  data: T;
  error: null | { message: string; code?: string };
  count?: number | null;
};

function createAwaitableQueryBuilder<T>(response: QueryResponse<T>) {
  const builder: Record<string, unknown> & PromiseLike<QueryResponse<T>> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(response),
    single: vi.fn().mockResolvedValue(response),
    then: (onfulfilled, onrejected) => Promise.resolve(response).then(onfulfilled, onrejected),
  };

  return builder;
}

describe('RefundRepository', () => {
  it('returns role from users_profile in getUserRole', async () => {
    const usersProfile = createAwaitableQueryBuilder({
      data: { role: 'seller' },
      error: null,
    });

    const client = {
      from: vi.fn((table: string) => {
        if (table === 'users_profile') {
          return usersProfile;
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    vi.mocked(createClient).mockResolvedValue(client as never);

    const repository = new RefundRepository();
    const role = await repository.getUserRole('seller-1');

    expect(role).toBe('seller');
    expect(usersProfile.eq).toHaveBeenCalledWith('user_id', 'seller-1');
  });

  it('applies seller order scope when listing refunds', async () => {
    const refundsRow = {
      refund_id: 'ref-1',
      refund_number: 'RFD-TEST-1',
      order_id: 'order-1',
      order_item_id: null,
      user_id: 'buyer-1',
      status: 'pending',
      refund_type: 'full_order',
      reason_code: 'damaged',
      reason_description: null,
      requested_amount: 25,
      refund_amount: 25,
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
      ai_analysis: null,
      evidence_images: null,
      created_at: '2026-04-20T00:00:00.000Z',
      updated_at: '2026-04-20T00:00:00.000Z',
    };

    const refunds = createAwaitableQueryBuilder({
      data: [refundsRow],
      count: 1,
      error: null,
    });

    const orderItems = createAwaitableQueryBuilder({
      data: [{ order_id: 'order-1' }, { order_id: 'order-1' }, { order_id: 'order-2' }],
      error: null,
    });

    const client = {
      from: vi.fn((table: string) => {
        if (table === 'refunds') {
          return refunds;
        }

        if (table === 'order_items') {
          return orderItems;
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    vi.mocked(createClient).mockResolvedValue(client as never);

    const repository = new RefundRepository();
    const result = await repository.list({
      page: 2,
      pageSize: 1,
      sortBy: 'recent',
      seller_id: 'seller-1',
    });

    expect(orderItems.eq).toHaveBeenCalledWith('seller_id', 'seller-1');
    expect(refunds.in).toHaveBeenCalledWith('order_id', ['order-1', 'order-2']);
    expect(result.refunds).toHaveLength(1);
    expect(result.pagination).toEqual({
      page: 2,
      pageSize: 1,
      totalCount: 1,
      totalPages: 1,
    });
  });

  it('returns empty pagination envelope when seller has no scoped orders', async () => {
    const refunds = createAwaitableQueryBuilder({
      data: [],
      count: 0,
      error: null,
    });

    const orderItems = createAwaitableQueryBuilder({
      data: [],
      error: null,
    });

    const client = {
      from: vi.fn((table: string) => {
        if (table === 'refunds') {
          return refunds;
        }

        if (table === 'order_items') {
          return orderItems;
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    vi.mocked(createClient).mockResolvedValue(client as never);

    const repository = new RefundRepository();
    const result = await repository.list({
      page: 1,
      pageSize: 20,
      sortBy: 'recent',
      seller_id: 'seller-with-no-orders',
    });

    expect(refunds.in).not.toHaveBeenCalled();
    expect(result).toEqual({
      refunds: [],
      pagination: {
        page: 1,
        pageSize: 20,
        totalCount: 0,
        totalPages: 0,
      },
    });
  });

  it('applies decision with optimistic status guard', async () => {
    const updatedRefund = {
      refund_id: 'ref-1',
      refund_number: 'RFD-TEST-1',
      order_id: 'order-1',
      order_item_id: null,
      user_id: 'buyer-1',
      status: 'approved',
      refund_type: 'full_order',
      reason_code: 'damaged',
      reason_description: null,
      requested_amount: 25,
      refund_amount: 25,
      return_required: false,
      return_tracking: null,
      return_received_at: null,
      payment_reference: null,
      processed_by: 'admin-1',
      processed_at: '2026-04-26T00:00:00.000Z',
      processing_notes: '{"decision":"approve"}',
      refunded_at: null,
      ai_recommendation: null,
      ai_risk_score: null,
      ai_processed_at: null,
      ai_analysis: null,
      evidence_images: null,
      created_at: '2026-04-20T00:00:00.000Z',
      updated_at: '2026-04-20T00:00:00.000Z',
    };

    const refunds = createAwaitableQueryBuilder({
      data: updatedRefund,
      error: null,
    });

    const orderItems = createAwaitableQueryBuilder({
      data: [
        {
          order_item_id: 'oi-1',
          product_id: 'prod-1',
          quantity: 1,
          unit_price: 25,
          total_price: 25,
        },
      ],
      error: null,
    });

    const client = {
      from: vi.fn((table: string) => {
        if (table === 'refunds') {
          return refunds;
        }

        if (table === 'order_items') {
          return orderItems;
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    vi.mocked(createClient).mockResolvedValue(client as never);

    const repository = new RefundRepository();
    const result = await repository.applyDecision({
      refundId: 'ref-1',
      fromStatus: 'pending',
      toStatus: 'approved',
      processedBy: 'admin-1',
      processedAt: '2026-04-26T00:00:00.000Z',
      processingNotes: '{"decision":"approve"}',
    });

    expect(refunds.eq).toHaveBeenCalledWith('refund_id', 'ref-1');
    expect(refunds.eq).toHaveBeenCalledWith('status', 'pending');
    expect(result?.status).toBe('approved');
    expect(result?.processed_by).toBe('admin-1');
  });
});
