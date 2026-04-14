import type { Database, Json } from '@/lib/types/database.types';
import type {
  BuyerOrderDetailResult,
  BuyerOrderListFilters,
  BuyerOrderListResult,
  CreateOrderInput,
  OrderAddress,
  OrderWithItemsResult,
  SkippedOrderItem,
} from '@/lib/models/order.model';
import {
  createOrder,
  createOrderItems,
  decreaseProductInventory,
  deleteOrder,
  fetchBuyerOrdersPaginated,
  fetchCartByUserId,
  fetchCartItems,
  fetchBuyerFeedbackByOrderItemIds,
  fetchOrderByIdForBuyer,
  fetchOrderItemsByOrderId,
  fetchProductsByIds,
  fetchUserRole,
  removeCartItems,
} from '@/lib/repositories/order.repository';

type ProductStatus = Database['public']['Enums']['product_status_enum'];

type NormalizedSourceItem = {
  product_id: string;
  quantity: number;
};

type ValidOrderItem = {
  product_id: string;
  seller_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  snapshot: Json;
};

function normalizeUserId(userId: string): string {
  const normalized = userId.trim();
  if (!normalized) {
    throw new Error('User ID is required');
  }

  return normalized;
}

function getPrimaryImage(images: Json | null): string | null {
  if (!Array.isArray(images) || images.length === 0) {
    return null;
  }

  const first = images[0];
  return typeof first === 'string' && first.length > 0 ? first : null;
}

function normalizeAmount(value: number | undefined): number {
  if (value === undefined) {
    return 0;
  }

  if (!Number.isFinite(value)) {
    throw new Error('Invalid amount');
  }

  return Number(value.toFixed(2));
}

function toSnapshot(name: string, shortDescription: string | null, images: Json | null): Json {
  return {
    name,
    short_description: shortDescription,
    image: getPrimaryImage(images),
  };
}

function normalizeDirectItems(items: CreateOrderInput['items']): NormalizedSourceItem[] {
  const source = items ?? [];
  const quantityMap = new Map<string, number>();

  for (const item of source) {
    const productId = item.product_id.trim();
    const quantity = Math.trunc(item.quantity);

    if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
      continue;
    }

    quantityMap.set(productId, (quantityMap.get(productId) ?? 0) + quantity);
  }

  return Array.from(quantityMap.entries()).map(([product_id, quantity]) => ({
    product_id,
    quantity,
  }));
}

function toOrderAddressJson(address: OrderAddress | undefined): Json | null {
  if (!address) {
    return null;
  }

  return {
    full_name: address.full_name,
    phone: address.phone,
    address_line_1: address.address_line_1,
    address_line_2: address.address_line_2 ?? null,
    city: address.city,
    state: address.state ?? null,
    postal_code: address.postal_code ?? null,
    country: address.country,
  };
}

function computeOrderNumber(): string {
  const now = new Date();
  const stamp = now
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ORD-${stamp}-${suffix}`;
}

async function requireBuyerRole(userId: string): Promise<void> {
  const role = await fetchUserRole(userId);
  const allowedRoles = new Set(['buyer', 'seller']);

  if (!role) {
    throw new Error('UNAUTHENTICATED');
  }

  if (!allowedRoles.has(role)) {
    throw new Error('FORBIDDEN');
  }
}

async function getSourceItems(
  userId: string,
  input: CreateOrderInput,
): Promise<{ cartId: string | null; items: NormalizedSourceItem[] }> {
  if (input.source === 'direct') {
    return { cartId: null, items: normalizeDirectItems(input.items) };
  }

  const cart = await fetchCartByUserId(userId);
  if (!cart) {
    const fallbackItems = normalizeDirectItems(input.items);
    return { cartId: null, items: fallbackItems };
  }

  const cartItems = await fetchCartItems(cart.cart_id);
  const items = cartItems
    .map((item) => ({ product_id: item.product_id.trim(), quantity: Math.trunc(item.quantity) }))
    .filter(
      (item) => item.product_id.length > 0 && Number.isFinite(item.quantity) && item.quantity > 0,
    );

  if (items.length === 0) {
    const fallbackItems = normalizeDirectItems(input.items);
    if (fallbackItems.length > 0) {
      return { cartId: cart.cart_id, items: fallbackItems };
    }
  }

  return { cartId: cart.cart_id, items };
}

function classifyItem(
  item: NormalizedSourceItem,
  product: {
    product_id: string;
    seller_id: string;
    name: string;
    short_description: string | null;
    images: Json | null;
    status: ProductStatus;
    inventory_quantity: number;
    price: number;
  } | null,
): { valid: ValidOrderItem | null; skipped: SkippedOrderItem | null } {
  if (item.quantity <= 0) {
    return {
      valid: null,
      skipped: {
        product_id: item.product_id,
        quantity: item.quantity,
        reason: 'invalid_quantity',
      },
    };
  }

  if (!product) {
    return {
      valid: null,
      skipped: {
        product_id: item.product_id,
        quantity: item.quantity,
        reason: 'product_not_found',
      },
    };
  }

  if (product.status !== 'active') {
    return {
      valid: null,
      skipped: {
        product_id: item.product_id,
        quantity: item.quantity,
        reason: 'product_inactive',
      },
    };
  }

  if (product.inventory_quantity < item.quantity) {
    return {
      valid: null,
      skipped: {
        product_id: item.product_id,
        quantity: item.quantity,
        reason: 'insufficient_inventory',
      },
    };
  }

  const unitPrice = Number(product.price.toFixed(2));
  const totalPrice = Number((unitPrice * item.quantity).toFixed(2));

  return {
    valid: {
      product_id: product.product_id,
      seller_id: product.seller_id,
      quantity: item.quantity,
      unit_price: unitPrice,
      total_price: totalPrice,
      snapshot: toSnapshot(product.name, product.short_description, product.images),
    },
    skipped: null,
  };
}

export async function createOrderFromInput(
  userId: string,
  input: CreateOrderInput,
): Promise<OrderWithItemsResult> {
  const normalizedUserId = normalizeUserId(userId);
  await requireBuyerRole(normalizedUserId);

  const { cartId, items: sourceItems } = await getSourceItems(normalizedUserId, input);

  if (sourceItems.length === 0) {
    throw new Error('No items available to create order');
  }

  const uniqueProductIds = Array.from(new Set(sourceItems.map((item) => item.product_id)));
  const products = await fetchProductsByIds(uniqueProductIds);
  const productMap = new Map(products.map((product) => [product.product_id, product]));

  const validItems: ValidOrderItem[] = [];
  const skippedItems: SkippedOrderItem[] = [];

  for (const item of sourceItems) {
    const result = classifyItem(item, productMap.get(item.product_id) ?? null);
    if (result.valid) {
      validItems.push(result.valid);
    }
    if (result.skipped) {
      skippedItems.push(result.skipped);
    }
  }

  if (validItems.length === 0) {
    throw new Error('No valid items available to create order');
  }

  for (const item of validItems) {
    await decreaseProductInventory(item.product_id, item.quantity);
  }

  const subtotal = Number(validItems.reduce((sum, item) => sum + item.total_price, 0).toFixed(2));
  const shippingAmount = normalizeAmount(input.shipping_amount);
  const taxAmount = normalizeAmount(input.tax_amount);
  const discountAmount = normalizeAmount(input.discount_amount);
  const totalAmount = Number((subtotal + shippingAmount + taxAmount - discountAmount).toFixed(2));

  if (totalAmount < 0) {
    throw new Error('Total amount cannot be negative');
  }

  const order = await createOrder({
    buyer_id: normalizedUserId,
    order_number: computeOrderNumber(),
    status: 'confirmed',
    payment_status: 'pending',
    subtotal,
    shipping_amount: shippingAmount,
    tax_amount: taxAmount,
    discount_amount: discountAmount,
    total_amount: totalAmount,
    notes: input.notes ?? null,
    shipping_address: toOrderAddressJson(input.shipping_address),
    billing_address: toOrderAddressJson(input.billing_address),
    payment_method: input.payment_method ?? null,
    currency: input.currency ?? 'USD',
  });

  try {
    const createdItems = await createOrderItems(
      validItems.map((item) => ({
        order_id: order.order_id,
        product_id: item.product_id,
        seller_id: item.seller_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
        status: 'confirmed',
        product_snapshot: item.snapshot,
      })),
    );

    if (input.source === 'cart' && cartId) {
      await removeCartItems(
        cartId,
        validItems.map((item) => item.product_id),
      );
    }

    return {
      order,
      items: createdItems,
      skipped_items: skippedItems,
    };
  } catch (error) {
    await deleteOrder(order.order_id);
    throw error;
  }
}

export async function getBuyerOrders(
  userId: string,
  filters: BuyerOrderListFilters,
): Promise<BuyerOrderListResult> {
  const normalizedUserId = normalizeUserId(userId);
  await requireBuyerRole(normalizedUserId);

  const page = Number.isFinite(filters.page) && filters.page > 0 ? Math.trunc(filters.page) : 1;
  const pageSize =
    Number.isFinite(filters.pageSize) && filters.pageSize > 0 ? Math.trunc(filters.pageSize) : 20;

  const { orders, totalCount } = await fetchBuyerOrdersPaginated({
    buyerId: normalizedUserId,
    page,
    pageSize,
    status: filters.status,
  });

  return {
    orders,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages: totalCount > 0 ? Math.ceil(totalCount / pageSize) : 0,
    },
  };
}

export async function getBuyerOrderById(
  userId: string,
  orderId: string,
): Promise<BuyerOrderDetailResult> {
  const normalizedUserId = normalizeUserId(userId);
  const normalizedOrderId = orderId.trim();

  if (!normalizedOrderId) {
    throw new Error('Order ID is required');
  }

  await requireBuyerRole(normalizedUserId);

  const order = await fetchOrderByIdForBuyer(normalizedOrderId, normalizedUserId);
  if (!order) {
    throw new Error('Order not found');
  }

  const items = await fetchOrderItemsByOrderId(order.order_id);
  const feedbackRows = await fetchBuyerFeedbackByOrderItemIds(
    normalizedUserId,
    items.map((item) => item.order_item_id),
  );

  const feedbackByOrderItemId = feedbackRows.reduce<BuyerOrderDetailResult['feedbackByOrderItemId']>(
    (accumulator, feedback) => {
      if (!feedback.order_item_id || accumulator[feedback.order_item_id]) {
        return accumulator;
      }

      accumulator[feedback.order_item_id] = {
        feedback_id: feedback.feedback_id,
        status: feedback.status,
      };

      return accumulator;
    },
    {},
  );

  return {
    order,
    items,
    feedbackByOrderItemId,
  };
}
