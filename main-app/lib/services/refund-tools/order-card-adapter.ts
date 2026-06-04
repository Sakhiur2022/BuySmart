import type { Order, OrderItem } from '@/lib/models/order.model';
import type { RefundOrderCard } from '@/lib/services/refund-tools/types';

type Snapshot = { image?: string | null; name?: string | null } | null | undefined;

function toSnapshot(value: unknown): Snapshot {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as Snapshot;
}

function getPrimaryProductName(items: OrderItem[] | undefined): string | null {
  if (!items || items.length === 0) {
    return null;
  }

  let primaryName: string | null = null;
  for (const item of items) {
    const snapshot = toSnapshot((item as { product_snapshot?: unknown }).product_snapshot);
    if (snapshot?.name && typeof snapshot.name === 'string') {
      primaryName = snapshot.name;
      break;
    }
  }

  if (!primaryName) {
    return items.length > 1 ? `${items.length} items` : null;
  }

  if (items.length > 1) {
    return `${primaryName} +${items.length - 1} more`;
  }

  return primaryName;
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
    product_name: getPrimaryProductName(items),
    thumbnail_url: getThumbnailUrl(items),
  };
}
