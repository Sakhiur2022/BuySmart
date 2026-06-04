import type { Database } from '@/lib/types/database.types';

export type RefundOrderCard = {
  order_id: string;
  order_number?: string | null;
  created_at: string;
  status: Database['public']['Enums']['order_status_enum'];
  total_amount: number;
  currency: string;
  product_name?: string | null;
  thumbnail_url?: string | null;
};

export type RefundOrdersFetchResult = {
  orders: RefundOrderCard[];
};

export type RefundSubmitResult = {
  refund: {
    refund_id: string;
    refund_number: string;
    order_id: string;
    status: Database['public']['Enums']['refund_status_enum'];
    requested_amount: number;
    created_at: string;
  };
};

export type RefundToolErrorDetails = {
  kind: 'business' | 'validation' | 'infrastructure' | 'unknown';
  retriable: boolean;
  mascotTrigger: boolean;
};
