'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type {
  CartItemWithProduct,
  CartProductDetails,
  LocalCartSyncItem,
  UserCartSummary,
  UserCartResult,
} from '@/lib/models/cart.model';
import { createClient } from '@/lib/supabase/client';

type CartContextValue = {
  items: CartItemWithProduct[];
  summary: UserCartSummary;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean | null;
  addItem: (productId: string, quantity?: number) => Promise<void>;
  updateItemQuantity: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
};

type LocalCartStorage = {
  items: LocalCartSyncItem[];
};

const LOCAL_CART_KEY = 'buysmart.cart';
const DEFAULT_SUMMARY: UserCartSummary = { totalItems: 0, totalAmount: 0 };

const CartContext = createContext<CartContextValue | null>(null);

function normalizeLocalItems(items: LocalCartSyncItem[]): LocalCartSyncItem[] {
  const quantityMap = new Map<string, number>();

  for (const item of items) {
    const productId = item.product_id?.trim();
    if (!productId) {
      continue;
    }

    const quantity = Math.trunc(Number(item.quantity));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      continue;
    }

    quantityMap.set(productId, (quantityMap.get(productId) ?? 0) + quantity);
  }

  return Array.from(quantityMap.entries()).map(([product_id, quantity]) => ({
    product_id,
    quantity,
  }));
}

function readLocalCart(): LocalCartSyncItem[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_CART_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as LocalCartStorage;
    return Array.isArray(parsed.items) ? normalizeLocalItems(parsed.items) : [];
  } catch {
    return [];
  }
}

function writeLocalCart(items: LocalCartSyncItem[]) {
  if (typeof window === 'undefined') {
    return;
  }

  if (items.length === 0) {
    window.localStorage.removeItem(LOCAL_CART_KEY);
    return;
  }

  const payload: LocalCartStorage = { items };
  window.localStorage.setItem(LOCAL_CART_KEY, JSON.stringify(payload));
}

function buildLocalCart(
  items: LocalCartSyncItem[],
  productsById?: Map<string, CartProductDetails>,
): {
  items: CartItemWithProduct[];
  summary: UserCartSummary;
} {
  const timestamp = new Date().toISOString();
  const cartItems: CartItemWithProduct[] = items.map((item) => {
    const product = productsById?.get(item.product_id) ?? null;

    return {
      cart_item_id: `local-${item.product_id}`,
      cart_id: 'local',
      product_id: item.product_id,
      quantity: item.quantity,
      created_at: timestamp,
      updated_at: timestamp,
      line_total: product ? product.price * item.quantity : 0,
      product,
    };
  });

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = cartItems.reduce((sum, item) => sum + item.line_total, 0);

  return {
    items: cartItems,
    summary: {
      totalItems,
      totalAmount,
    },
  };
}

async function fetchLocalProducts(productIds: string[]): Promise<CartProductDetails[]> {
  const uniqueIds = Array.from(
    new Set(productIds.map((id) => id.trim()).filter((id) => id.length > 0)),
  );

  if (uniqueIds.length === 0) {
    return [];
  }

  const params = new URLSearchParams({ ids: uniqueIds.join(',') });
  const response = await fetch(`/api/products/lookup?${params.toString()}`);
  const payload = (await response.json()) as { products?: CartProductDetails[]; error?: string };

  if (!response.ok) {
    throw new Error(payload?.error ?? 'Unable to load product details.');
  }

  return Array.isArray(payload.products) ? payload.products : [];
}

async function parseCartResponse(response: Response): Promise<UserCartResult> {
  if (response.ok) {
    const data = (await response.json()) as { cart: UserCartResult };
    return data.cart;
  }

  let errorMessage = 'Unable to update cart.';
  try {
    const payload = (await response.json()) as { error?: string };
    if (payload?.error) {
      errorMessage = payload.error;
    }
  } catch {
    // Ignore JSON parsing errors, fallback to default message.
  }

  throw new Error(errorMessage);
}

function applyCartResult(
  result: UserCartResult,
  setItems: (items: CartItemWithProduct[]) => void,
  setSummary: (summary: UserCartSummary) => void,
) {
  setItems(result.items ?? []);
  setSummary(result.summary ?? DEFAULT_SUMMARY);
}

export function CartProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<CartItemWithProduct[]>([]);
  const [summary, setSummary] = useState<UserCartSummary>(DEFAULT_SUMMARY);
  const [localItems, setLocalItems] = useState<LocalCartSyncItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const localItemsRef = useRef<LocalCartSyncItem[]>([]);
  const localProductRequestIdRef = useRef(0);

  useEffect(() => {
    localItemsRef.current = localItems;
  }, [localItems]);

  const setLocalState = useCallback((nextItems: LocalCartSyncItem[]) => {
    const normalized = normalizeLocalItems(nextItems);
    setLocalItems(normalized);
    writeLocalCart(normalized);

    const localCart = buildLocalCart(normalized);
    setItems(localCart.items);
    setSummary(localCart.summary);
  }, []);

  const syncLocalCart = useCallback(
    async (itemsToSync: LocalCartSyncItem[]) => {
      if (itemsToSync.length === 0) {
        return;
      }

      const response = await fetch('/api/cart/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ items: itemsToSync }),
      });

      const cartResult = await parseCartResponse(response);
      applyCartResult(cartResult, setItems, setSummary);
      setLocalState([]);
    },
    [setLocalState],
  );

  const refreshCart = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/cart', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const cartResult = await parseCartResponse(response);
      applyCartResult(cartResult, setItems, setSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load cart.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isActive = true;
    const stored = readLocalCart();
    setLocalItems(stored);

    const localCart = buildLocalCart(stored);
    setItems(localCart.items);
    setSummary(localCart.summary);

    const initialize = async () => {
      setIsLoading(true);

      let isAuthed = false;
      try {
        const { data, error: authError } = await supabase.auth.getUser();
        if (!isActive) {
          return;
        }

        if (authError || !data.user) {
          setIsAuthenticated(false);
          return;
        }

        setIsAuthenticated(true);
        isAuthed = true;
      } catch (err) {
        if (isActive) {
          setIsAuthenticated(false);
          setError(err instanceof Error ? err.message : 'Unable to load cart.');
        }
        return;
      } finally {
        if (!isActive || !isAuthed) {
          if (isActive) {
            setIsLoading(false);
          }
          return;
        }
      }

      try {
        if (stored.length > 0) {
          await syncLocalCart(stored);
        } else {
          await refreshCart();
        }
      } catch (err) {
        if (isActive) {
          setError(err instanceof Error ? err.message : 'Unable to load cart.');
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isActive) {
        return;
      }

      if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
        const guestItems = readLocalCart();
        setLocalState(guestItems);
        return;
      }

      if (event === 'SIGNED_IN' && session?.user) {
        setIsAuthenticated(true);
        setError(null);

        const pendingLocalItems = localItemsRef.current;
        if (pendingLocalItems.length > 0) {
          try {
            await syncLocalCart(pendingLocalItems);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to sync cart.');
          }
        } else {
          await refreshCart();
        }
      }
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [refreshCart, setLocalState, supabase, syncLocalCart]);

  useEffect(() => {
    if (isAuthenticated !== false) {
      return;
    }

    if (localItems.length === 0) {
      const localCart = buildLocalCart(localItems);
      setItems(localCart.items);
      setSummary(localCart.summary);
      return;
    }

    let isActive = true;
    const requestId = ++localProductRequestIdRef.current;

    const hydrateLocalCart = async () => {
      try {
        const products = await fetchLocalProducts(localItems.map((item) => item.product_id));
        if (!isActive || requestId !== localProductRequestIdRef.current) {
          return;
        }

        const productsById = new Map(products.map((product) => [product.product_id, product]));
        const localCart = buildLocalCart(localItems, productsById);
        setItems(localCart.items);
        setSummary(localCart.summary);
      } catch (err) {
        if (!isActive || requestId !== localProductRequestIdRef.current) {
          return;
        }

        setError(err instanceof Error ? err.message : 'Unable to load cart details.');
      }
    };

    hydrateLocalCart();

    return () => {
      isActive = false;
    };
  }, [isAuthenticated, localItems]);

  const addItem = useCallback(
    async (productId: string, quantity = 1) => {
      const normalizedProductId = productId.trim();
      const normalizedQuantity = Math.trunc(Number(quantity));

      if (!normalizedProductId || !Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
        return;
      }

      setError(null);

      if (!isAuthenticated) {
        const nextItems = [...localItemsRef.current];
        const existing = nextItems.find((item) => item.product_id === normalizedProductId);
        if (existing) {
          existing.quantity += normalizedQuantity;
        } else {
          nextItems.push({ product_id: normalizedProductId, quantity: normalizedQuantity });
        }
        setLocalState(nextItems);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch('/api/cart/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ product_id: normalizedProductId, quantity: normalizedQuantity }),
        });

        const cartResult = await parseCartResponse(response);
        applyCartResult(cartResult, setItems, setSummary);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to add item.');
      } finally {
        setIsLoading(false);
      }
    },
    [isAuthenticated, setLocalState],
  );

  const updateItemQuantity = useCallback(
    async (productId: string, quantity: number) => {
      const normalizedProductId = productId.trim();
      const normalizedQuantity = Math.trunc(Number(quantity));

      if (!normalizedProductId || !Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
        return;
      }

      setError(null);

      if (!isAuthenticated) {
        const nextItems = [...localItemsRef.current];
        const existing = nextItems.find((item) => item.product_id === normalizedProductId);
        if (!existing) {
          return;
        }

        existing.quantity = normalizedQuantity;
        setLocalState(nextItems);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(`/api/cart/items/${normalizedProductId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ quantity: normalizedQuantity }),
        });

        const cartResult = await parseCartResponse(response);
        applyCartResult(cartResult, setItems, setSummary);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to update item.');
      } finally {
        setIsLoading(false);
      }
    },
    [isAuthenticated, setLocalState],
  );

  const removeItem = useCallback(
    async (productId: string) => {
      const normalizedProductId = productId.trim();

      if (!normalizedProductId) {
        return;
      }

      setError(null);

      if (!isAuthenticated) {
        const nextItems = localItemsRef.current.filter(
          (item) => item.product_id !== normalizedProductId,
        );
        setLocalState(nextItems);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(`/api/cart/items/${normalizedProductId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });

        const cartResult = await parseCartResponse(response);
        applyCartResult(cartResult, setItems, setSummary);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to remove item.');
      } finally {
        setIsLoading(false);
      }
    },
    [isAuthenticated, setLocalState],
  );

  const clearCart = useCallback(async () => {
    setError(null);

    if (!isAuthenticated) {
      setLocalState([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/cart/items', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const cartResult = await parseCartResponse(response);
      applyCartResult(cartResult, setItems, setSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to clear cart.');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, setLocalState]);

  const value: CartContextValue = {
    items,
    summary,
    isLoading,
    error,
    isAuthenticated,
    addItem,
    updateItemQuantity,
    removeItem,
    clearCart,
    refreshCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }

  return context;
}
