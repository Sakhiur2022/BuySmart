/** @vitest-environment jsdom */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CheckoutPage from '@/app/(buyer)/buyer/checkout/page';
import { useCart } from '@/lib/context/cart-context';
import { createClient } from '@/lib/supabase/client';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('@/lib/context/cart-context', () => ({
  useCart: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}));

describe('Checkout page cart -> order integration', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());

    vi.mocked(useCart).mockReturnValue({
      items: [
        {
          cart_item_id: 'c-1',
          cart_id: 'cart-1',
          product_id: 'p-1',
          quantity: 2,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          line_total: 200,
          product: {
            product_id: 'p-1',
            name: 'Demo Product',
            price: 100,
            short_description: null,
          },
        },
      ],
      summary: { totalItems: 2, totalAmount: 200 },
      isLoading: false,
      error: null,
      isAuthenticated: true,
      addItem: vi.fn(),
      updateItemQuantity: vi.fn(),
      removeItem: vi.fn(),
      clearCart: vi.fn(),
      refreshCart: vi.fn(),
    });

    const inMock = vi.fn().mockResolvedValue({
      data: [{ product_id: 'p-1', name: 'Demo Product', inventory_quantity: 10 }],
      error: null,
    });
    const selectMock = vi.fn(() => ({ in: inMock }));
    const fromMock = vi.fn(() => ({ select: selectMock }));

    vi.mocked(createClient).mockReturnValue({
      from: fromMock,
    } as never);
  });

  it('submits source=cart payload with schema-aligned shipping address and redirects on success', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        order: {
          order: {
            order_id: 'ord-123',
          },
        },
      }),
    } as Response);

    render(<CheckoutPage />);

    fireEvent.change(screen.getByLabelText('Full name'), {
      target: { value: 'Sakhiur Rahman' },
    });
    fireEvent.change(screen.getByLabelText('Phone number'), {
      target: { value: '+8801712345678' },
    });
    fireEvent.change(screen.getByLabelText('Street address'), {
      target: { value: '123 Bashundhara R/A' },
    });
    fireEvent.change(screen.getByLabelText('City'), {
      target: { value: 'Dhaka' },
    });
    fireEvent.change(screen.getByLabelText('Postal code'), {
      target: { value: '1229' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Place order' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/orders',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    const [, requestInit] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(requestInit.body));

    expect(payload).toMatchObject({
      source: 'cart',
      items: [{ product_id: 'p-1', quantity: 2 }],
      shipping_address: {
        full_name: 'Sakhiur Rahman',
        phone: '+8801712345678',
        address_line_1: '123 Bashundhara R/A',
        city: 'Dhaka',
        postal_code: '1229',
        country: 'BD',
      },
    });

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/orders/ord-123/confirmation');
    });
  });

  it('surfaces API error field when order creation fails', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Unauthorized: Not authenticated' }),
    } as Response);

    render(<CheckoutPage />);

    fireEvent.change(screen.getByLabelText('Full name'), {
      target: { value: 'Sakhiur Rahman' },
    });
    fireEvent.change(screen.getByLabelText('Phone number'), {
      target: { value: '+8801712345678' },
    });
    fireEvent.change(screen.getByLabelText('Street address'), {
      target: { value: '123 Bashundhara R/A' },
    });
    fireEvent.change(screen.getByLabelText('City'), {
      target: { value: 'Dhaka' },
    });
    fireEvent.change(screen.getByLabelText('Postal code'), {
      target: { value: '1229' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Place order' }));

    await waitFor(() => {
      expect(screen.getByText('Unauthorized: Not authenticated')).toBeInTheDocument();
    });

    expect(pushMock).not.toHaveBeenCalled();
  });
});
