"use client";

import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';

type CartItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
};

type CartState = {
  items: CartItem[];
  totalQuantity: number;
  totalAmount: number;
};

type CartAction =
  | { type: 'ADD_ITEM'; payload: CartItem }
  | { type: 'REMOVE_ITEM'; payload: { productId: string } }
  | { type: 'UPDATE_QUANTITY'; payload: { productId: string; quantity: number } }
  | { type: 'CLEAR_CART' }
  | { type: 'HYDRATE'; payload: CartItem[] };

interface CartContextValue {
  state: CartState;
  addItem: (item: CartItem) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
}

const CART_STORAGE_KEY = 'buysmart-cart';

const initialState: CartState = {
  items: [],
  totalQuantity: 0,
  totalAmount: 0,
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

function calculateTotals(items: CartItem[]) {
  return {
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    totalAmount: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
  };
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'HYDRATE': {
      const items = action.payload.map((item) => ({
        ...item,
        quantity: Math.max(1, item.quantity),
      }));
      return {
        items,
        ...calculateTotals(items),
      };
    }
    case 'ADD_ITEM': {
      const existingItem = state.items.find((item) => item.productId === action.payload.productId);
      const items = existingItem
        ? state.items.map((item) =>
            item.productId === action.payload.productId
              ? { ...item, quantity: item.quantity + action.payload.quantity }
              : item,
          )
        : [...state.items, { ...action.payload, quantity: Math.max(1, action.payload.quantity) }];

      return {
        items,
        ...calculateTotals(items),
      };
    }
    case 'REMOVE_ITEM': {
      const items = state.items.filter((item) => item.productId !== action.payload.productId);
      return {
        items,
        ...calculateTotals(items),
      };
    }
    case 'UPDATE_QUANTITY': {
      const items = state.items
        .map((item) =>
          item.productId === action.payload.productId
            ? { ...item, quantity: Math.max(0, action.payload.quantity) }
            : item,
        )
        .filter((item) => item.quantity > 0);

      return {
        items,
        ...calculateTotals(items),
      };
    }
    case 'CLEAR_CART':
      return initialState;
    default:
      return state;
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(CART_STORAGE_KEY);
      if (!saved) return;

      const parsed = JSON.parse(saved) as CartItem[];
      if (Array.isArray(parsed)) {
        dispatch({ type: 'HYDRATE', payload: parsed });
      }
    } catch {
      // ignore invalid persisted cart data
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.items));
    } catch {
      // persistence is best-effort only
    }
  }, [state.items]);

  const contextValue = useMemo(
    () => ({
      state,
      addItem: (item: CartItem) => dispatch({ type: 'ADD_ITEM', payload: item }),
      removeItem: (productId: string) => dispatch({ type: 'REMOVE_ITEM', payload: { productId } }),
      updateQuantity: (productId: string, quantity: number) =>
        dispatch({ type: 'UPDATE_QUANTITY', payload: { productId, quantity } }),
      clearCart: () => dispatch({ type: 'CLEAR_CART' }),
    }),
    [state],
  );

  return <CartContext.Provider value={contextValue}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
}
