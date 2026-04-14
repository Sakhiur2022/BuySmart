/** @vitest-environment jsdom */

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const supabaseState = vi.hoisted(() => ({
  user: null as { id: string } | null,
  throwOnGetUser: false,
  authCallback: null as
    | ((
        event: 'SIGNED_IN' | 'SIGNED_OUT',
        session: { user: { id: string } } | null,
      ) => Promise<void> | void)
    | null,
  unsubscribe: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockImplementation(async () => {
        if (supabaseState.throwOnGetUser) {
          throw new Error('auth failed');
        }

        return {
          data: { user: supabaseState.user },
          error: null,
        };
      }),
      onAuthStateChange: vi.fn().mockImplementation((callback) => {
        supabaseState.authCallback = callback;
        return {
          data: {
            subscription: {
              unsubscribe: supabaseState.unsubscribe,
            },
          },
        };
      }),
    },
  }),
}));

import { CartProvider, useCart } from '@/lib/context/cart-context';

function jsonResponse(payload: unknown, ok = true): Response {
  return {
    ok,
    json: async () => payload,
  } as Response;
}

describe('CartProvider context', () => {
  beforeEach(() => {
    window.localStorage.clear();
    supabaseState.user = null;
    supabaseState.throwOnGetUser = false;
    supabaseState.authCallback = null;
    supabaseState.unsubscribe.mockReset();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (input: string, init?: RequestInit) => {
        const method = init?.method ?? 'GET';

        if (input.startsWith('/api/products/lookup')) {
          return jsonResponse({ products: [] });
        }

        if (input === '/api/cart' && method === 'GET') {
          return jsonResponse({
            cart: {
              items: [],
              summary: { totalItems: 0, totalAmount: 0 },
            },
          });
        }

        return jsonResponse({
          cart: {
            items: [],
            summary: { totalItems: 0, totalAmount: 0 },
          },
        });
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
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items.find((item) => item.product_id === 'p-2')?.quantity).toBe(3);
  });

  it('addItem merges same product quantity for guest cart', async () => {
    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
    });

    await act(async () => {
      await result.current.addItem('p-1', 2);
    });

    await waitFor(() => {
      expect(result.current.summary.totalItems).toBe(2);
    });

    await act(async () => {
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

  it('updateItemQuantity updates existing item quantity for guest cart', async () => {
    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
    });

    await act(async () => {
      await result.current.addItem('p-1', 2);
    });

    await waitFor(() => {
      expect(result.current.summary.totalItems).toBe(2);
    });

    await act(async () => {
      await result.current.updateItemQuantity('p-1', 4);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(4);
    expect(result.current.summary.totalItems).toBe(4);
  });

  it('removeItem removes only matching product', async () => {
    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
    });

    await act(async () => {
      await result.current.addItem('p-1', 1);
    });

    await waitFor(() => {
      expect(result.current.summary.totalItems).toBe(1);
    });

    await act(async () => {
      await result.current.addItem('p-2', 1);
    });

    await waitFor(() => {
      expect(result.current.summary.totalItems).toBe(2);
    });

    await act(async () => {
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

  it('loads remote cart for authenticated user on initialization', async () => {
    supabaseState.user = { id: 'u-1' };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (input: string, init?: RequestInit) => {
        const method = init?.method ?? 'GET';
        if (input === '/api/cart' && method === 'GET') {
          return jsonResponse({
            cart: {
              items: [
                {
                  cart_item_id: 'c-1',
                  cart_id: 'cart-1',
                  product_id: 'p-10',
                  quantity: 2,
                  created_at: '2026-01-01T00:00:00.000Z',
                  updated_at: '2026-01-01T00:00:00.000Z',
                  line_total: 100,
                  product: null,
                },
              ],
              summary: { totalItems: 2, totalAmount: 100 },
            },
          });
        }

        return jsonResponse({ products: [] });
      }),
    );

    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.summary.totalItems).toBe(2);
    expect(result.current.summary.totalAmount).toBe(100);
  });

  it('performs authenticated cart item operations through API routes', async () => {
    supabaseState.user = { id: 'u-2' };

    const apiState = {
      quantity: 1,
    };

    const fetchMock = vi.fn().mockImplementation(async (input: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';

      if (input === '/api/cart' && method === 'GET') {
        return jsonResponse({
          cart: {
            items: [
              {
                cart_item_id: 'c-2',
                cart_id: 'cart-2',
                product_id: 'p-20',
                quantity: apiState.quantity,
                created_at: '2026-01-01T00:00:00.000Z',
                updated_at: '2026-01-01T00:00:00.000Z',
                line_total: apiState.quantity * 10,
                product: null,
              },
            ],
            summary: { totalItems: apiState.quantity, totalAmount: apiState.quantity * 10 },
          },
        });
      }

      if (input === '/api/cart/items' && method === 'POST') {
        apiState.quantity = 3;
      }

      if (input === '/api/cart/items/p-20' && method === 'PATCH') {
        apiState.quantity = 5;
      }

      if (input === '/api/cart/items/p-20' && method === 'DELETE') {
        return jsonResponse({
          cart: {
            items: [],
            summary: { totalItems: 0, totalAmount: 0 },
          },
        });
      }

      if (input === '/api/cart/items' && method === 'DELETE') {
        return jsonResponse({
          cart: {
            items: [],
            summary: { totalItems: 0, totalAmount: 0 },
          },
        });
      }

      return jsonResponse({
        cart: {
          items: [
            {
              cart_item_id: 'c-2',
              cart_id: 'cart-2',
              product_id: 'p-20',
              quantity: apiState.quantity,
              created_at: '2026-01-01T00:00:00.000Z',
              updated_at: '2026-01-01T00:00:00.000Z',
              line_total: apiState.quantity * 10,
              product: null,
            },
          ],
          summary: { totalItems: apiState.quantity, totalAmount: apiState.quantity * 10 },
        },
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    await act(async () => {
      await result.current.addItem('p-20', 2);
    });
    expect(result.current.summary.totalItems).toBe(3);

    await act(async () => {
      await result.current.updateItemQuantity('p-20', 5);
    });
    expect(result.current.summary.totalItems).toBe(5);

    await act(async () => {
      await result.current.removeItem('p-20');
    });
    expect(result.current.items).toHaveLength(0);

    await act(async () => {
      await result.current.clearCart();
    });
    expect(result.current.summary.totalItems).toBe(0);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/cart/items',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/cart/items/p-20',
      expect.objectContaining({ method: 'PATCH' }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/cart/items/p-20',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/cart/items',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('sets error when authenticated cart API returns non-ok response', async () => {
    supabaseState.user = { id: 'u-3' };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (input: string, init?: RequestInit) => {
        const method = init?.method ?? 'GET';

        if (input === '/api/cart' && method === 'GET') {
          return jsonResponse(
            {
              error: 'cart unavailable',
            },
            false,
          );
        }

        return jsonResponse({ products: [] });
      }),
    );

    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    await waitFor(() => {
      expect(result.current.error).toBe('cart unavailable');
    });
  });

  it('handles auth signed out and signed in transitions', async () => {
    supabaseState.user = null;

    const fetchMock = vi.fn().mockImplementation(async (input: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';

      if (input.startsWith('/api/products/lookup')) {
        return jsonResponse({ products: [] });
      }

      if (input === '/api/cart' && method === 'GET') {
        return jsonResponse({
          cart: {
            items: [],
            summary: { totalItems: 0, totalAmount: 0 },
          },
        });
      }

      if (input === '/api/cart/sync' && method === 'POST') {
        return jsonResponse({
          cart: {
            items: [
              {
                cart_item_id: 'c-3',
                cart_id: 'cart-3',
                product_id: 'p-30',
                quantity: 1,
                created_at: '2026-01-01T00:00:00.000Z',
                updated_at: '2026-01-01T00:00:00.000Z',
                line_total: 10,
                product: null,
              },
            ],
            summary: { totalItems: 1, totalAmount: 10 },
          },
        });
      }

      return jsonResponse({
        cart: {
          items: [],
          summary: { totalItems: 0, totalAmount: 0 },
        },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
    });

    await act(async () => {
      await result.current.addItem('p-30', 1);
    });

    await waitFor(() => {
      expect(result.current.summary.totalItems).toBe(1);
    });

    await act(async () => {
      await supabaseState.authCallback?.('SIGNED_IN', { user: { id: 'u-4' } });
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/cart/sync',
      expect.objectContaining({ method: 'POST' }),
    );

    await act(async () => {
      await supabaseState.authCallback?.('SIGNED_OUT', null);
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  it('sets error when auth lookup throws', async () => {
    supabaseState.throwOnGetUser = true;

    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
    });

    expect(result.current.error).toBe('auth failed');
  });
});
