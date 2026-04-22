import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/app/api/cart/_shared', () => ({
  requireAuthenticatedUser: vi.fn(),
}));

vi.mock('@/lib/controllers/refund.controller', () => ({
  createRefund: vi.fn(),
  listRefunds: vi.fn(),
}));

import { requireAuthenticatedUser } from '@/app/api/cart/_shared';
import { createRefund, listRefunds } from '@/lib/controllers/refund.controller';
import {
  RefundIneligiblePaymentStatusError,
  RefundIneligibleStatusError,
  RefundInvalidAmountError,
} from '@/lib/services/refund.service';
import { GET, POST } from '@/app/api/refunds/route';

describe('POST /api/refunds', () => {
  it('returns 201 when refund creation succeeds', async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({ userId: 'buyer-1' });
    vi.mocked(createRefund).mockResolvedValue({
      refund_id: '8e8573db-4e4f-46ef-a3d3-640849531458',
      refund_number: 'RFD-202604190001-ABCD12',
      order_id: '03f14e69-cd59-44a8-b63d-f2f59ab9f62e',
      order_item_id: null,
      user_id: 'buyer-1',
      status: 'pending',
      reason_code: 'damaged',
      refund_type: 'full_order',
      requested_amount: 80,
      refund_amount: 80,
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

    const req = new NextRequest('http://localhost/api/refunds', {
      method: 'POST',
      body: JSON.stringify({
        order_id: '03f14e69-cd59-44a8-b63d-f2f59ab9f62e',
        refund_type: 'full_order',
        reason_code: 'damaged',
        requested_amount: 80,
      }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(createRefund).toHaveBeenCalledWith('buyer-1', {
      order_id: '03f14e69-cd59-44a8-b63d-f2f59ab9f62e',
      refund_type: 'full_order',
      reason_code: 'damaged',
      requested_amount: 80,
      return_required: false,
      currency: 'USD',
    });
    expect(body.refund.refund_id).toBe('8e8573db-4e4f-46ef-a3d3-640849531458');
  });

  it('returns 400 for invalid JSON payload', async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({ userId: 'buyer-1' });

    const req = new NextRequest('http://localhost/api/refunds', {
      method: 'POST',
      body: '{ invalid-json',
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid JSON payload');
  });

  it('returns 400 when payload validation fails', async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({ userId: 'buyer-1' });

    const req = new NextRequest('http://localhost/api/refunds', {
      method: 'POST',
      body: JSON.stringify({
        reason_code: 'damaged',
      }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Validation failed');
  });

  it('returns 422 when order status is ineligible', async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({ userId: 'buyer-1' });
    vi.mocked(createRefund).mockRejectedValue(new RefundIneligibleStatusError('processing'));

    const req = new NextRequest('http://localhost/api/refunds', {
      method: 'POST',
      body: JSON.stringify({
        order_id: '03f14e69-cd59-44a8-b63d-f2f59ab9f62e',
        refund_type: 'full_order',
        reason_code: 'damaged',
        requested_amount: 20,
      }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.code).toBe('REFUND_INELIGIBLE_STATUS');
  });

  it('returns 422 when payment status is ineligible', async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({ userId: 'buyer-1' });
    vi.mocked(createRefund).mockRejectedValue(
      new RefundIneligiblePaymentStatusError('pending'),
    );

    const req = new NextRequest('http://localhost/api/refunds', {
      method: 'POST',
      body: JSON.stringify({
        order_id: '03f14e69-cd59-44a8-b63d-f2f59ab9f62e',
        refund_type: 'full_order',
        reason_code: 'damaged',
        requested_amount: 20,
      }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.code).toBe('REFUND_INELIGIBLE_PAYMENT_STATUS');
  });

  it('returns 400 when amount is invalid', async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({ userId: 'buyer-1' });
    vi.mocked(createRefund).mockRejectedValue(
      new RefundInvalidAmountError('Requested refund amount must be greater than zero'),
    );

    const req = new NextRequest('http://localhost/api/refunds', {
      method: 'POST',
      body: JSON.stringify({
        order_id: '03f14e69-cd59-44a8-b63d-f2f59ab9f62e',
        refund_type: 'full_order',
        reason_code: 'damaged',
        requested_amount: 20,
      }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('REFUND_INVALID_AMOUNT');
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(requireAuthenticatedUser).mockRejectedValue(new Error('UNAUTHENTICATED'));

    const req = new NextRequest('http://localhost/api/refunds', {
      method: 'POST',
      body: JSON.stringify({
        order_id: '03f14e69-cd59-44a8-b63d-f2f59ab9f62e',
        refund_type: 'full_order',
        reason_code: 'damaged',
        requested_amount: 20,
      }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized: Not authenticated');
  });
});

describe('GET /api/refunds', () => {
  it('returns 200 with list response for valid query params', async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({ userId: 'buyer-1' });
    vi.mocked(listRefunds).mockResolvedValue({
      refunds: [
        {
          refund_id: '8e8573db-4e4f-46ef-a3d3-640849531458',
          refund_number: 'RFD-202604190001-ABCD12',
          order_id: '03f14e69-cd59-44a8-b63d-f2f59ab9f62e',
          user_id: 'buyer-1',
          status: 'pending',
          reason_code: 'damaged',
          refund_type: 'full_order',
          requested_amount: 80,
          refund_amount: 80,
          created_at: '2026-04-19T00:00:00.000Z',
          updated_at: '2026-04-19T00:00:00.000Z',
        },
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        totalCount: 1,
        totalPages: 1,
      },
    } as never);

    const req = new NextRequest('http://localhost/api/refunds?page=1&pageSize=20&status=pending');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.refunds).toHaveLength(1);
    expect(listRefunds).toHaveBeenCalledWith('buyer-1', {
      page: 1,
      pageSize: 20,
      status: 'pending',
      sortBy: 'recent',
    });
  });
});
