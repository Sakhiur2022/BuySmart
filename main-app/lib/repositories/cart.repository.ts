import type { Database } from '@/lib/types/database.types';
import type { Cart, CartItem } from '@/lib/models/cart.model';
import { createClient } from '@/lib/supabase/server';

const CARTS_TABLE = 'carts';
const CART_ITEMS_TABLE = 'cart_items';
const PRODUCTS_TABLE = 'products';

type ProductStatus = Database['public']['Enums']['product_status_enum'];

export interface CartProductRecord {
  product_id: string;
  name: string;
  price: number;
  images: unknown;
  short_description: string | null;
  status: ProductStatus;
}

export async function fetchCartByUserId(userId: string): Promise<Cart | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(CARTS_TABLE)
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as Cart | null) ?? null;
}

export async function createCart(userId: string): Promise<Cart> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(CARTS_TABLE)
    .insert({ user_id: userId })
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Cart;
}

export async function getOrCreateCart(userId: string): Promise<Cart> {
  const existing = await fetchCartByUserId(userId);
  if (existing) {
    return existing;
  }

  return createCart(userId);
}

export async function fetchCartItems(cartId: string): Promise<CartItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(CART_ITEMS_TABLE)
    .select('*')
    .eq('cart_id', cartId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as CartItem[];
}

export async function upsertCartItem(
  cartId: string,
  productId: string,
  quantity: number,
): Promise<CartItem> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(CART_ITEMS_TABLE)
    .upsert(
      {
        cart_id: cartId,
        product_id: productId,
        quantity,
      },
      { onConflict: 'cart_id,product_id' },
    )
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as CartItem;
}

export async function removeCartItem(cartId: string, productId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from(CART_ITEMS_TABLE)
    .delete()
    .eq('cart_id', cartId)
    .eq('product_id', productId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function clearCartItems(cartId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from(CART_ITEMS_TABLE).delete().eq('cart_id', cartId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchProductsByIds(productIds: string[]): Promise<CartProductRecord[]> {
  if (productIds.length === 0) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from(PRODUCTS_TABLE)
    .select('product_id, name, price, images, short_description, status')
    .in('product_id', productIds);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as CartProductRecord[];
}
