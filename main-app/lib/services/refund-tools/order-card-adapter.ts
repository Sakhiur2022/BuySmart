import type { Order, OrderItem } from '@/lib/models/order.model';
import type { RefundOrderCard } from '@/lib/services/refund-tools/types';

type Snapshot = { image?: string | null } | null | undefined;

function toSnapshot(value: unknown): Snapshot {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as Snapshot;
}

function getThumbnailUrl(items: OrderItem[] | undefined): string | null {
  if (!items || items.length === 0) {
    return null;
  }

  for (const item of items) {
    const snapshot = toSnapshot((item as { product_snapshot?: unknown }).product_snapshot);
    if (snapshot?.image && typeof snapshot.image === 'string') {
      return snapshot.image;
    }
  }

  return null;
}

export function toRefundOrderCard(order: Order, items?: OrderItem[]): RefundOrderCard {
  return {
    order_id: order.order_id,
    order_number: order.order_number ?? null,
    created_at: order.created_at,
    status: order.status,
    total_amount: order.total_amount,
    currency: order.currency ?? 'USD',
    thumbnail_url: getThumbnailUrl(items),
  };
}
