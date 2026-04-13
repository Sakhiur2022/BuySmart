import type { Database, Json } from '@/lib/types/database.types';
import { createClient } from '@/lib/supabase/server';

type UserRole = Database['public']['Enums']['user_role_enum'];
type OrderInsert = Database['public']['Tables']['orders']['Insert'];
type OrderRow = Database['public']['Tables']['orders']['Row'];
type OrderItemInsert = Database['public']['Tables']['order_items']['Insert'];
type OrderItemRow = Database['public']['Tables']['order_items']['Row'];
type OrderStatus = Database['public']['Enums']['order_status_enum'];
type CartRow = Database['public']['Tables']['carts']['Row'];
type CartItemRow = Database['public']['Tables']['cart_items']['Row'];

type FeedbackStatus = Database['public']['Enums']['feedback_status_enum'];

export interface CheckoutProductRecord {
  product_id: string;
  seller_id: string;
  name: string;
  short_description: string | null;
  images: Json | null;
  status: Database['public']['Enums']['product_status_enum'];
  inventory_quantity: number;
  price: number;
}

export interface BuyerOrderItemFeedbackRecord {
  feedback_id: string;
  order_item_id: string;
  status: FeedbackStatus;
}

export async function fetchUserRole(userId: string): Promise<UserRole | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('users_profile')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data?.role as UserRole | undefined) ?? null;
}

export async function fetchCartByUserId(userId: string): Promise<CartRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('carts')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as CartRow | null) ?? null;
}

export async function fetchCartItems(cartId: string): Promise<CartItemRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('cart_items')
    .select('*')
    .eq('cart_id', cartId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as CartItemRow[];
}

export async function fetchProductsByIds(productIds: string[]): Promise<CheckoutProductRecord[]> {
  if (productIds.length === 0) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .select('product_id,seller_id,name,short_description,images,status,inventory_quantity,price')
    .in('product_id', productIds);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as CheckoutProductRecord[];
}

export async function decreaseProductInventory(productId: string, quantity: number): Promise<void> {
  const supabase = await createClient();

  const { data: current, error: currentError } = await supabase
    .from('products')
    .select('inventory_quantity')
    .eq('product_id', productId)
    .maybeSingle();

  if (currentError) {
    throw new Error(currentError.message);
  }

  const currentQuantity = current?.inventory_quantity;
  if (typeof currentQuantity !== 'number' || currentQuantity < quantity) {
    throw new Error('Insufficient inventory');
  }

  const { error: updateError } = await supabase
    .from('products')
    .update({ inventory_quantity: currentQuantity - quantity })
    .eq('product_id', productId);

  if (updateError) {
    throw new Error(updateError.message);
  }
}

export async function createOrder(order: OrderInsert): Promise<OrderRow> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('orders').insert(order).select('*').single();

  if (error) {
    throw new Error(error.message);
  }

  return data as OrderRow;
}

export async function createOrderItems(orderItems: OrderItemInsert[]): Promise<OrderItemRow[]> {
  if (orderItems.length === 0) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from('order_items').insert(orderItems).select('*');

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as OrderItemRow[];
}

export async function deleteOrder(orderId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('orders').delete().eq('order_id', orderId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function removeCartItems(cartId: string, productIds: string[]): Promise<void> {
  if (productIds.length === 0) {
    return;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('cart_items')
    .delete()
    .eq('cart_id', cartId)
    .in('product_id', productIds);

  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchBuyerOrdersPaginated(input: {
  buyerId: string;
  page: number;
  pageSize: number;
  status?: OrderStatus;
}): Promise<{ orders: OrderRow[]; totalCount: number }> {
  const supabase = await createClient();
  const offset = (input.page - 1) * input.pageSize;

  let query = supabase
    .from('orders')
    .select('*', { count: 'exact' })
    .eq('buyer_id', input.buyerId)
    .order('created_at', { ascending: false })
    .range(offset, offset + input.pageSize - 1);

  if (input.status) {
    query = query.eq('status', input.status);
  }

  const { data, count, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return {
    orders: (data ?? []) as OrderRow[],
    totalCount: count ?? 0,
  };
}

export async function fetchOrderByIdForBuyer(
  orderId: string,
  buyerId: string,
): Promise<OrderRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('order_id', orderId)
    .eq('buyer_id', buyerId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as OrderRow | null) ?? null;
}

export async function fetchOrderItemsByOrderId(orderId: string): Promise<OrderItemRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as OrderItemRow[];
}

export async function fetchBuyerFeedbackByOrderItemIds(
  buyerId: string,
  orderItemIds: string[],
): Promise<BuyerOrderItemFeedbackRecord[]> {
  if (orderItemIds.length === 0) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('feedback')
    .select('feedback_id, order_item_id, status')
    .eq('user_id', buyerId)
    .eq('feedback_type', 'product_review')
    .in('order_item_id', orderItemIds)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as BuyerOrderItemFeedbackRecord[];
}
