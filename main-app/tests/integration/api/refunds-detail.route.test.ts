import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/app/api/cart/_shared', () => ({
  requireAuthenticatedUser: vi.fn(),
}));

vi.mock('@/lib/controllers/refund.controller', () => ({
  getRefundById: vi.fn(),
}));

import { requireAuthenticatedUser } from '@/app/api/cart/_shared';
import { getRefundById } from '@/lib/controllers/refund.controller';
import { GET } from '@/app/api/refunds/[id]/route';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/refunds/[id]', () => {
  it('returns 200 for buyer in scope', async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({ userId: 'buyer-1' });
    vi.mocked(getRefundById).mockResolvedValue({
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
      buyer: { user_id: 'buyer-1', full_name: 'Buyer One', email: null },
      seller: { user_id: 'seller-1', full_name: 'Seller One', email: null },
      order: {
        order_id: '03f14e69-cd59-44a8-b63d-f2f59ab9f62e',
        order_number: 'ORD-001',
        created_at: '2026-04-18T00:00:00.000Z',
        currency: 'USD',
        total_amount: 80,
      },
      items: [],
      reason_description: null,
      processing_notes: null,
      ai_recommendation: null,
      ai_risk_score: null,
      ai_processed_at: null,
      return_required: false,
      return_tracking: null,
      return_received_at: null,
      refunded_at: null,
    } as never);

    const req = new NextRequest('http://localhost/api/refunds/8e8573db-4e4f-46ef-a3d3-640849531458');
    const res = await GET(req, {
      params: Promise.resolve({ id: '8e8573db-4e4f-46ef-a3d3-640849531458' }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(getRefundById).toHaveBeenCalledWith(
      'buyer-1',
      '8e8573db-4e4f-46ef-a3d3-640849531458',
    );
    expect(body.refund.refund_id).toBe('8e8573db-4e4f-46ef-a3d3-640849531458');
  });

  it('returns 200 for seller in scope', async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({ userId: 'seller-1' });
    vi.mocked(getRefundById).mockResolvedValue({ refund_id: 'ref-1' } as never);

    const req = new NextRequest('http://localhost/api/refunds/8e8573db-4e4f-46ef-a3d3-640849531458');
    const res = await GET(req, {
      params: Promise.resolve({ id: '8e8573db-4e4f-46ef-a3d3-640849531458' }),
    });

    expect(res.status).toBe(200);
    expect(getRefundById).toHaveBeenCalledWith(
      'seller-1',
      '8e8573db-4e4f-46ef-a3d3-640849531458',
    );
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(requireAuthenticatedUser).mockRejectedValue(new Error('UNAUTHENTICATED'));

    const req = new NextRequest('http://localhost/api/refunds/8e8573db-4e4f-46ef-a3d3-640849531458');
    const res = await GET(req, {
      params: Promise.resolve({ id: '8e8573db-4e4f-46ef-a3d3-640849531458' }),
    });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized: Not authenticated');
  });

  it('returns 400 when id validation fails', async () => {
    const req = new NextRequest('http://localhost/api/refunds/not-a-uuid');
    const res = await GET(req, {
      params: Promise.resolve({ id: 'not-a-uuid' }),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Validation failed');
  });

  it('returns 403 for buyer out of scope', async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({ userId: 'buyer-2' });
    vi.mocked(getRefundById).mockRejectedValue(new Error('FORBIDDEN'));

    const req = new NextRequest('http://localhost/api/refunds/8e8573db-4e4f-46ef-a3d3-640849531458');
    const res = await GET(req, {
      params: Promise.resolve({ id: '8e8573db-4e4f-46ef-a3d3-640849531458' }),
    });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('Forbidden: Insufficient permissions');
  });

  it('returns 403 for seller out of scope', async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({ userId: 'seller-2' });
    vi.mocked(getRefundById).mockRejectedValue(new Error('FORBIDDEN'));

    const req = new NextRequest('http://localhost/api/refunds/8e8573db-4e4f-46ef-a3d3-640849531458');
    const res = await GET(req, {
      params: Promise.resolve({ id: '8e8573db-4e4f-46ef-a3d3-640849531458' }),
    });

    expect(res.status).toBe(403);
  });

  it('returns 404 when refund does not exist', async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({ userId: 'buyer-1' });
    vi.mocked(getRefundById).mockRejectedValue(new Error('Refund not found'));

    const req = new NextRequest('http://localhost/api/refunds/8e8573db-4e4f-46ef-a3d3-640849531458');
    const res = await GET(req, {
      params: Promise.resolve({ id: '8e8573db-4e4f-46ef-a3d3-640849531458' }),
    });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Refund not found');
  });

  it('returns 500 for unexpected failures', async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({ userId: 'buyer-1' });
    vi.mocked(getRefundById).mockRejectedValue(new Error('boom'));

    const req = new NextRequest('http://localhost/api/refunds/8e8573db-4e4f-46ef-a3d3-640849531458');
    const res = await GET(req, {
      params: Promise.resolve({ id: '8e8573db-4e4f-46ef-a3d3-640849531458' }),
    });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
