import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { GET, POST } from '@/app/api/orders/route';

vi.mock('@/app/api/cart/_shared', () => ({
  requireAuthenticatedUser: vi.fn(),
}));

vi.mock('@/lib/services/order.service', () => ({
  createOrderFromInput: vi.fn(),
  getBuyerOrders: vi.fn(),
}));

import { requireAuthenticatedUser } from '@/app/api/cart/_shared';
import { createOrderFromInput, getBuyerOrders } from '@/lib/services/order.service';

describe('GET /api/orders', () => {
  it('returns 200 with orders for valid query params', async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({ userId: 'user-1' });
    vi.mocked(getBuyerOrders).mockResolvedValue({
      orders: [{ order_id: 'ord-1', status: 'confirmed' }],
      pagination: { page: 1, pageSize: 20, totalCount: 1, totalPages: 1 },
    } as never);

    const req = new NextRequest('http://localhost/api/orders?page=1&pageSize=20&status=confirmed');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(getBuyerOrders).toHaveBeenCalledWith('user-1', {
      page: 1,
      pageSize: 20,
      status: 'confirmed',
    });
    expect(body.orders).toHaveLength(1);
  });

  it('returns 400 when status query is invalid', async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({ userId: 'user-1' });

    const req = new NextRequest('http://localhost/api/orders?status=bad-status');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Validation failed');
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(requireAuthenticatedUser).mockRejectedValue(new Error('UNAUTHENTICATED'));

    const req = new NextRequest('http://localhost/api/orders');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized: Not authenticated');
  });
});

describe('POST /api/orders', () => {
  it('returns 400 for invalid JSON payload', async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({ userId: 'user-1' });

    const req = new NextRequest('http://localhost/api/orders', {
      method: 'POST',
      body: '{ not-json',
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid JSON payload');
  });

  it('returns 400 when source is direct without items', async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({ userId: 'user-1' });

    const req = new NextRequest('http://localhost/api/orders', {
      method: 'POST',
      body: JSON.stringify({ source: 'direct' }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Validation failed');
  });

  it('returns 201 when order creation succeeds', async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({ userId: 'user-1' });
    vi.mocked(createOrderFromInput).mockResolvedValue({ order_id: 'ord-created' } as never);

    const req = new NextRequest('http://localhost/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        source: 'direct',
        items: [{ product_id: 'p-1', quantity: 1 }],
      }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(createOrderFromInput).toHaveBeenCalledWith('user-1', {
      source: 'direct',
      items: [{ product_id: 'p-1', quantity: 1 }],
    });
    expect(body.order.order_id).toBe('ord-created');
  });

  it('returns 201 for cart source with schema-aligned address', async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({ userId: 'user-1' });
    vi.mocked(createOrderFromInput).mockResolvedValue({
      order: { order_id: 'ord-cart' },
      items: [],
      skipped_items: [],
    } as never);

    const req = new NextRequest('http://localhost/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        source: 'cart',
        shipping_address: {
          full_name: 'Sakhiur Rahman',
          phone: '+8801712345678',
          address_line_1: '123 Bashundhara R/A',
          city: 'Dhaka',
          postal_code: '1229',
          country: 'BD',
        },
      }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(createOrderFromInput).toHaveBeenCalledWith('user-1', {
      source: 'cart',
      shipping_address: {
        full_name: 'Sakhiur Rahman',
        phone: '+8801712345678',
        address_line_1: '123 Bashundhara R/A',
        city: 'Dhaka',
        postal_code: '1229',
        country: 'BD',
      },
    });
    expect(body.order.order.order_id).toBe('ord-cart');
  });

  it('returns 400 for business error no valid items', async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({ userId: 'user-1' });
    vi.mocked(createOrderFromInput).mockRejectedValue(
      new Error('No valid items available to create order'),
    );

    const req = new NextRequest('http://localhost/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        source: 'direct',
        items: [{ product_id: 'p-1', quantity: 1 }],
      }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('No valid items available to create order');
  });
});
