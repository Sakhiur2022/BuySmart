import type {
  Cart,
  CartItem,
  CartItemWithProduct,
  CartProductDetails,
  LocalCartSyncItem,
  UserCartResult,
} from '@/lib/models/cart.model';
import {
  clearCartItems,
  fetchCartItems,
  fetchProductsByIds,
  getOrCreateCart,
  removeCartItem,
  upsertCartItem,
} from '@/lib/repositories/cart.repository';

function normalizeUserId(userId: string): string {
  const normalized = userId.trim();

  if (!normalized) {
    throw new Error('User ID is required');
  }

  return normalized;
}

function getPositiveInt(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error('Quantity must be a valid number');
  }

  const parsed = Math.trunc(value);
  if (parsed <= 0) {
    throw new Error('Quantity must be at least 1');
  }

  return parsed;
}

function getPrimaryImage(images: unknown): string | undefined {
  if (!Array.isArray(images) || images.length === 0) {
    return undefined;
  }

  const firstImage = images[0];
  return typeof firstImage === 'string' && firstImage.length > 0 ? firstImage : undefined;
}

function normalizeSyncItems(items: LocalCartSyncItem[]): LocalCartSyncItem[] {
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

function buildCartResult(
  cart: Cart,
  cartItems: CartItem[],
  products: Awaited<ReturnType<typeof fetchProductsByIds>>,
): UserCartResult {
  const productMap = new Map(products.map((product) => [product.product_id, product]));

  const items: CartItemWithProduct[] = cartItems.map((item) => {
    const product = productMap.get(item.product_id);

    const productDetails: CartProductDetails | null = product
      ? {
          product_id: product.product_id,
          name: product.name,
          price: product.price,
          image: getPrimaryImage(product.images),
          short_description: product.short_description,
        }
      : null;

    return {
      ...item,
      line_total: productDetails ? productDetails.price * item.quantity : 0,
      product: productDetails,
    };
  });

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = items.reduce((sum, item) => sum + item.line_total, 0);

  return {
    cart,
    items,
    summary: {
      totalItems,
      totalAmount,
    },
  };
}

async function getCartWithItems(userId: string): Promise<{ cart: Cart; items: CartItem[] }> {
  const cart = await getOrCreateCart(userId);
  const items = await fetchCartItems(cart.cart_id);

  return { cart, items };
}

async function ensureProductExists(productId: string): Promise<void> {
  const products = await fetchProductsByIds([productId]);
  const product = products[0];

  if (!product || product.status !== 'active') {
    throw new Error('Product not found');
  }
}

export async function getFullCartWithProductDetails(userId: string): Promise<UserCartResult> {
  const normalizedUserId = normalizeUserId(userId);
  const { cart, items } = await getCartWithItems(normalizedUserId);
  const products = await fetchProductsByIds(items.map((item) => item.product_id));

  return buildCartResult(cart, items, products);
}

export async function syncLocalCartOnLogin(
  userId: string,
  localItems: LocalCartSyncItem[],
): Promise<UserCartResult> {
  const normalizedUserId = normalizeUserId(userId);
  const normalizedItems = normalizeSyncItems(localItems);
  const { cart, items: dbItems } = await getCartWithItems(normalizedUserId);

  if (normalizedItems.length > 0) {
    const products = await fetchProductsByIds(normalizedItems.map((item) => item.product_id));
    const availableProductIds = new Set(
      products
        .filter((product) => product.status === 'active')
        .map((product) => product.product_id),
    );
    const existingQuantityByProduct = new Map(
      dbItems.map((item) => [item.product_id, item.quantity]),
    );

    for (const item of normalizedItems) {
      if (!availableProductIds.has(item.product_id)) {
        continue;
      }

      const existingQuantity = existingQuantityByProduct.get(item.product_id) ?? 0;
      const targetQuantity = existingQuantity + item.quantity;

      await upsertCartItem(cart.cart_id, item.product_id, targetQuantity);
    }
  }

  return getFullCartWithProductDetails(normalizedUserId);
}

export async function addCartItem(
  userId: string,
  productId: string,
  quantity: number,
): Promise<UserCartResult> {
  const normalizedUserId = normalizeUserId(userId);
  const normalizedProductId = productId.trim();
  const normalizedQuantity = getPositiveInt(quantity);

  if (!normalizedProductId) {
    throw new Error('Product ID is required');
  }

  await ensureProductExists(normalizedProductId);

  const { cart, items } = await getCartWithItems(normalizedUserId);
  const existing = items.find((item) => item.product_id === normalizedProductId);
  const targetQuantity = existing ? existing.quantity + normalizedQuantity : normalizedQuantity;

  await upsertCartItem(cart.cart_id, normalizedProductId, targetQuantity);

  return getFullCartWithProductDetails(normalizedUserId);
}

export async function updateCartItemQuantity(
  userId: string,
  productId: string,
  quantity: number,
): Promise<UserCartResult> {
  const normalizedUserId = normalizeUserId(userId);
  const normalizedProductId = productId.trim();
  const normalizedQuantity = getPositiveInt(quantity);

  if (!normalizedProductId) {
    throw new Error('Product ID is required');
  }

  const { cart, items } = await getCartWithItems(normalizedUserId);
  const existing = items.find((item) => item.product_id === normalizedProductId);

  if (!existing) {
    throw new Error('Cart item not found');
  }

  await upsertCartItem(cart.cart_id, normalizedProductId, normalizedQuantity);

  return getFullCartWithProductDetails(normalizedUserId);
}

export async function removeCartItemByProduct(
  userId: string,
  productId: string,
): Promise<UserCartResult> {
  const normalizedUserId = normalizeUserId(userId);
  const normalizedProductId = productId.trim();

  if (!normalizedProductId) {
    throw new Error('Product ID is required');
  }

  const { cart } = await getCartWithItems(normalizedUserId);
  await removeCartItem(cart.cart_id, normalizedProductId);

  return getFullCartWithProductDetails(normalizedUserId);
}

export async function clearUserCart(userId: string): Promise<UserCartResult> {
  const normalizedUserId = normalizeUserId(userId);
  const { cart } = await getCartWithItems(normalizedUserId);

  await clearCartItems(cart.cart_id);

  return getFullCartWithProductDetails(normalizedUserId);
}
