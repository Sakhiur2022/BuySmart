/** @vitest-environment jsdom */

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      }),
    },
  }),
}));

import { CartProvider, useCart } from '@/lib/context/cart-context';

describe('CartProvider context', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ products: [] }),
      }),
    );
  });

  it('throws when useCart is used outside provider', () => {
    expect(() => renderHook(() => useCart())).toThrow('useCart must be used within CartProvider');
  });

  it('hydrates local cart and clamps invalid quantities', async () => {
    window.localStorage.setItem(
      'buysmart.cart',
      JSON.stringify({
        items: [
          { product_id: 'p-1', quantity: 0 },
          { product_id: 'p-2', quantity: 3.9 },
          { product_id: 'p-3', quantity: -5 },
        ],
      }),
    );

    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
    });

    expect(result.current.summary.totalItems).toBe(3);
    expect(result.current.items).toHaveLength(2);
    expect(result.current.items.find((item) => item.product_id === 'p-1')?.quantity).toBe(1);
    expect(result.current.items.find((item) => item.product_id === 'p-2')?.quantity).toBe(3);
  });

  it('addItem merges same product quantity for guest cart', async () => {
    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
    });

    await act(async () => {
      await result.current.addItem('p-1', 2);
      await result.current.addItem('p-1', 3);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.summary.totalItems).toBe(5);

    const raw = window.localStorage.getItem('buysmart.cart');
    const parsed = JSON.parse(raw ?? '{}') as {
      items: Array<{ product_id: string; quantity: number }>;
    };
    expect(parsed.items[0]).toEqual({ product_id: 'p-1', quantity: 5 });
  });

  it('updateItemQuantity with 0 removes item', async () => {
    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
    });

    await act(async () => {
      await result.current.addItem('p-1', 2);
      await result.current.updateItemQuantity('p-1', 0);
    });

    expect(result.current.items).toHaveLength(0);
    expect(result.current.summary.totalItems).toBe(0);
  });

  it('removeItem removes only matching product', async () => {
    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
    });

    await act(async () => {
      await result.current.addItem('p-1', 1);
      await result.current.addItem('p-2', 1);
      await result.current.removeItem('p-1');
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].product_id).toBe('p-2');
  });

  it('clearCart resets guest cart to empty state', async () => {
    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
    });

    await act(async () => {
      await result.current.addItem('p-1', 2);
      await result.current.clearCart();
    });

    expect(result.current.items).toHaveLength(0);
    expect(result.current.summary.totalItems).toBe(0);
    expect(result.current.summary.totalAmount).toBe(0);
    expect(window.localStorage.getItem('buysmart.cart')).toBeNull();
  });
});
