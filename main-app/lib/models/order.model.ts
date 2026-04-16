import type { Database } from '@/lib/types/database.types';

type OrderRow = Database['public']['Tables']['orders']['Row'];
type OrderItemRow = Database['public']['Tables']['order_items']['Row'];
type OrderStatus = Database['public']['Enums']['order_status_enum'];
type PaymentStatus = Database['public']['Enums']['payment_status_enum'];
type OrderItemStatus = Database['public']['Enums']['order_item_status_enum'];

export type OrderAddress = {
  full_name: string;
  phone: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state?: string;
  postal_code?: string;
  country: string;
};

export interface CreateOrderDirectItemInput {
  product_id: string;
  quantity: number;
}

export interface CreateOrderInput {
  source: 'cart' | 'direct';
  items?: CreateOrderDirectItemInput[];
  notes?: string;
  shipping_address?: OrderAddress;
  billing_address?: OrderAddress;
  shipping_amount?: number;
  tax_amount?: number;
  discount_amount?: number;
  currency?: string;
  payment_method?: string;
}

export interface SkippedOrderItem {
  product_id: string;
  quantity: number;
  reason: 'product_not_found' | 'product_inactive' | 'insufficient_inventory' | 'invalid_quantity';
}

export interface OrderProductSnapshot {
  name: string;
  short_description: string | null;
  image: string | null;
}

export interface OrderWithItemsResult {
  order: OrderRow;
  items: OrderItemRow[];
  skipped_items: SkippedOrderItem[];
}

export interface BuyerOrderListFilters {
  page: number;
  pageSize: number;
  status?: OrderStatus;
  dateFrom?: string;
  dateTo?: string;
}

export interface BuyerOrderListResult {
  orders: OrderRow[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

export interface BuyerOrderDashboardStats {
  inProgressCount: number;
  deliveriesThisWeek: number;
}

export interface BuyerOrderDetailResult {
  order: OrderRow;
  items: OrderItemRow[];
  feedbackByOrderItemId: Record<
    string,
    {
      feedback_id: string;
      status: Database['public']['Enums']['feedback_status_enum'];
    }
  >;
}

export type Order = OrderRow;
export type OrderItem = OrderItemRow;
export type { OrderStatus, PaymentStatus, OrderItemStatus };
