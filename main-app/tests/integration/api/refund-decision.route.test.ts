import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/app/api/cart/_shared', () => ({
  requireAuthenticatedUser: vi.fn(),
}));

vi.mock('@/lib/controllers/refund.controller', () => ({
  approveRefund: vi.fn(),
  rejectRefund: vi.fn(),
  reviewRefund: vi.fn(),
}));

import { requireAuthenticatedUser } from '@/app/api/cart/_shared';
import { approveRefund, rejectRefund, reviewRefund } from '@/lib/controllers/refund.controller';
import { RefundInvalidDecisionTransitionError } from '@/lib/services/refund.service';
import { POST as approvePOST } from '@/app/api/refunds/[id]/approve/route';
import { POST as rejectPOST } from '@/app/api/refunds/[id]/reject/route';
import { POST as reviewPOST } from '@/app/api/refunds/[id]/review/route';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/refunds/[id]/approve', () => {
  it('returns 200 when approve succeeds', async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({ userId: 'admin-1' });
    vi.mocked(approveRefund).mockResolvedValue({
      refund_id: 'ref-1',
      status: 'approved',
      processed_by: 'admin-1',
    } as never);

    const req = new NextRequest('http://localhost/api/refunds/ref-1/approve', {
      method: 'POST',
      body: JSON.stringify({ processing_notes: 'approved' }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await approvePOST(req, {
      params: Promise.resolve({ id: '03f14e69-cd59-44a8-b63d-f2f59ab9f62e' }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(approveRefund).toHaveBeenCalledWith('admin-1', '03f14e69-cd59-44a8-b63d-f2f59ab9f62e', {
      processing_notes: 'approved',
    });
    expect(body.refund.status).toBe('approved');
  });

  it('returns 400 for invalid uuid param', async () => {
    const req = new NextRequest('http://localhost/api/refunds/not-uuid/approve', {
      method: 'POST',
      body: JSON.stringify({ processing_notes: 'approved' }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await approvePOST(req, { params: Promise.resolve({ id: 'not-uuid' }) });

    expect(res.status).toBe(400);
  });

  it('returns 401 for unauthenticated request', async () => {
    vi.mocked(requireAuthenticatedUser).mockRejectedValue(new Error('UNAUTHENTICATED'));

    const req = new NextRequest('http://localhost/api/refunds/ref-1/approve', {
      method: 'POST',
      body: JSON.stringify({ processing_notes: 'approved' }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await approvePOST(req, {
      params: Promise.resolve({ id: '03f14e69-cd59-44a8-b63d-f2f59ab9f62e' }),
    });

    expect(res.status).toBe(401);
  });
});

describe('POST /api/refunds/[id]/reject', () => {
  it('returns 400 when reject payload misses processing_notes', async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({ userId: 'admin-1' });

    const req = new NextRequest('http://localhost/api/refunds/ref-1/reject', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'content-type': 'application/json' },
    });

    const res = await rejectPOST(req, {
      params: Promise.resolve({ id: '03f14e69-cd59-44a8-b63d-f2f59ab9f62e' }),
    });

    expect(res.status).toBe(400);
  });

  it('returns 403 for forbidden actor', async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({ userId: 'buyer-1' });
    vi.mocked(rejectRefund).mockRejectedValue(new Error('FORBIDDEN'));

    const req = new NextRequest('http://localhost/api/refunds/ref-1/reject', {
      method: 'POST',
      body: JSON.stringify({ processing_notes: 'invalid claim' }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await rejectPOST(req, {
      params: Promise.resolve({ id: '03f14e69-cd59-44a8-b63d-f2f59ab9f62e' }),
    });

    expect(res.status).toBe(403);
  });
});

describe('POST /api/refunds/[id]/review', () => {
  it('returns 422 for invalid transition', async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({ userId: 'admin-1' });
    vi.mocked(reviewRefund).mockRejectedValue(
      new RefundInvalidDecisionTransitionError('completed', 'manual_review'),
    );

    const req = new NextRequest('http://localhost/api/refunds/ref-1/review', {
      method: 'POST',
      body: JSON.stringify({ processing_notes: 'manual check requested' }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await reviewPOST(req, {
      params: Promise.resolve({ id: '03f14e69-cd59-44a8-b63d-f2f59ab9f62e' }),
    });
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.code).toBe('REFUND_INVALID_DECISION_TRANSITION');
  });

  it('returns 404 when refund is missing', async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({ userId: 'admin-1' });
    vi.mocked(reviewRefund).mockRejectedValue(new Error('Refund not found'));

    const req = new NextRequest('http://localhost/api/refunds/ref-1/review', {
      method: 'POST',
      body: JSON.stringify({ processing_notes: 'manual check requested' }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await reviewPOST(req, {
      params: Promise.resolve({ id: '03f14e69-cd59-44a8-b63d-f2f59ab9f62e' }),
    });

    expect(res.status).toBe(404);
  });
});
