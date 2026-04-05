'use server';

import type { LocalCartSyncItem, UserCartResult } from '@/lib/models/cart.model';
import {
  addCartItem,
  clearUserCart,
  getFullCartWithProductDetails,
  removeCartItemByProduct,
  syncLocalCartOnLogin,
  updateCartItemQuantity,
} from '@/lib/services/cart.service';
import { createClient } from '@/lib/supabase/server';

type CartActionResult<T> =
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: string };

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('Session expired. Please log in again.');
  }

  return user.id;
}

function formatActionError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export async function getCartAction(): Promise<CartActionResult<UserCartResult>> {
  try {
    const userId = await requireUserId();
    const data = await getFullCartWithProductDetails(userId);

    return { success: true, data, error: null };
  } catch (error: unknown) {
    return {
      success: false,
      data: null,
      error: formatActionError(error, 'Failed to fetch cart'),
    };
  }
}

export async function syncCartAction(
  localItems: LocalCartSyncItem[],
): Promise<CartActionResult<UserCartResult>> {
  try {
    const userId = await requireUserId();
    const data = await syncLocalCartOnLogin(userId, localItems);

    return { success: true, data, error: null };
  } catch (error: unknown) {
    return {
      success: false,
      data: null,
      error: formatActionError(error, 'Failed to sync cart'),
    };
  }
}

export async function addCartItemAction(
  productId: string,
  quantity = 1,
): Promise<CartActionResult<UserCartResult>> {
  try {
    const userId = await requireUserId();
    const data = await addCartItem(userId, productId, quantity);

    return { success: true, data, error: null };
  } catch (error: unknown) {
    return {
      success: false,
      data: null,
      error: formatActionError(error, 'Failed to add item to cart'),
    };
  }
}

export async function updateCartItemQuantityAction(
  productId: string,
  quantity: number,
): Promise<CartActionResult<UserCartResult>> {
  try {
    const userId = await requireUserId();
    const data = await updateCartItemQuantity(userId, productId, quantity);

    return { success: true, data, error: null };
  } catch (error: unknown) {
    return {
      success: false,
      data: null,
      error: formatActionError(error, 'Failed to update cart item'),
    };
  }
}

export async function removeCartItemAction(
  productId: string,
): Promise<CartActionResult<UserCartResult>> {
  try {
    const userId = await requireUserId();
    const data = await removeCartItemByProduct(userId, productId);

    return { success: true, data, error: null };
  } catch (error: unknown) {
    return {
      success: false,
      data: null,
      error: formatActionError(error, 'Failed to remove cart item'),
    };
  }
}

export async function clearCartAction(): Promise<CartActionResult<UserCartResult>> {
  try {
    const userId = await requireUserId();
    const data = await clearUserCart(userId);

    return { success: true, data, error: null };
  } catch (error: unknown) {
    return {
      success: false,
      data: null,
      error: formatActionError(error, 'Failed to clear cart'),
    };
  }
}
