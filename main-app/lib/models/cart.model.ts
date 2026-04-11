export interface Cart {
  cart_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  cart_item_id: string;
  cart_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface CartProductDetails {
  product_id: string;
  name: string;
  price: number;
  image?: string;
  short_description: string | null;
}

export interface CartItemWithProduct {
  cart_item_id: string;
  cart_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
  line_total: number;
  product: CartProductDetails | null;
}

export interface UserCartSummary {
  totalItems: number;
  totalAmount: number;
}

export interface UserCartResult {
  cart: Cart;
  items: CartItemWithProduct[];
  summary: UserCartSummary;
}

export interface LocalCartSyncItem {
  product_id: string;
  quantity: number;
}
