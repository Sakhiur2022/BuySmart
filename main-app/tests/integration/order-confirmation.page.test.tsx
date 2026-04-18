/** @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NOT_FOUND');
  }),
);

vi.mock('next/navigation', () => ({
  notFound: notFoundMock,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import OrderConfirmationPage from '@/app/orders/[order_id]/confirmation/page';

describe('OrderConfirmationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders order confirmation details when order exists', async () => {
    const orderBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          order_id: 'ord-1',
          created_at: '2026-04-18T10:30:00.000Z',
          status: 'confirmed',
          shipping_address: {
            full_name: 'Sakhiur Rahman',
            phone: '+8801712345678',
            address_line_1: 'Dhaka',
            city: 'Dhaka',
            country: 'BD',
          },
        },
        error: null,
      }),
    };

    const orderItemsBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [
          {
            product_id: 'prod-1',
            quantity: 2,
            unit_price: 100,
            product_snapshot: { name: 'Demo Product' },
          },
        ],
        error: null,
      }),
    };

    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn((tableName: string) => {
        if (tableName === 'orders') {
          return orderBuilder;
        }

        return orderItemsBuilder;
      }),
    } as never);

    const page = await OrderConfirmationPage({
      params: Promise.resolve({ order_id: 'ord-1' }),
    });

    render(page);

    expect(screen.getByText('Order confirmed!')).toBeInTheDocument();
    expect(screen.getByText('ord-1')).toBeInTheDocument();
    expect(screen.getByText('Demo Product')).toBeInTheDocument();
    expect(screen.getAllByText('200 BDT')).toHaveLength(2);
    expect(screen.getByText('Bangladesh')).toBeInTheDocument();
  });

  it('calls notFound when order is missing', async () => {
    const orderBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      }),
    };

    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn(() => orderBuilder),
    } as never);

    await expect(
      OrderConfirmationPage({
        params: Promise.resolve({ order_id: 'missing-order' }),
      }),
    ).rejects.toThrow('NOT_FOUND');

    expect(notFoundMock).toHaveBeenCalledOnce();
  });
});
