import type { RefundOrderSignal } from '@/lib/chatbot/buyer-intent/types';
import type { BuyerOrderDetailResult } from '@/lib/models/order.model';
import { getBuyerOrderById, getBuyerOrders } from '@/lib/services/order.service';
import { fetchOrderItemsByOrderId } from '@/lib/repositories/order.repository';
import { RefundRepository } from '@/lib/repositories/refundRepository';
import { toRefundOrderCard } from '@/lib/services/refund-tools/order-card-adapter';
import type { RefundOrdersFetchResult } from '@/lib/services/refund-tools/types';

const DEFAULT_RECENT_ORDER_LIMIT = 5;

type RefundOrderLookup = {
  getRefundedOrderIdsByBuyer(buyerId: string): Promise<string[]>;
};

export type OrderFetchContext = {
  buyerId: string;
  orderSignal?: RefundOrderSignal;
  limit?: number;
};

export interface OrderFetchStrategy {
  canHandle(context: OrderFetchContext): boolean;
  fetch(context: OrderFetchContext): Promise<RefundOrdersFetchResult>;
}

export class RecentOrdersStrategy implements OrderFetchStrategy {
  private readonly refundOrderLookup: RefundOrderLookup;

  public constructor(input?: { refundOrderLookup?: RefundOrderLookup }) {
    this.refundOrderLookup = input?.refundOrderLookup ?? new RefundRepository();
  }

  canHandle(context: OrderFetchContext): boolean {
    return Boolean(context.orderSignal?.recentOrders || !context.orderSignal?.orderId);
  }

  async fetch(context: OrderFetchContext): Promise<RefundOrdersFetchResult> {
    const pageSize = context.limit ?? DEFAULT_RECENT_ORDER_LIMIT;
    const result = await getBuyerOrders(context.buyerId, {
      page: 1,
      pageSize,
    });

    const refundedOrderIds = new Set(
      await this.refundOrderLookup.getRefundedOrderIdsByBuyer(context.buyerId),
    );
    const eligibleOrders = result.orders.filter((order) => !refundedOrderIds.has(order.order_id));

    const ordersWithItems = await Promise.all(
      eligibleOrders.map(async (order) => ({
        order,
        items: await fetchOrderItemsByOrderId(order.order_id),
      })),
    );

    return {
      orders: ordersWithItems.map(({ order, items }) => toRefundOrderCard(order, items)),
    };
  }
}

export class SpecificOrderStrategy implements OrderFetchStrategy {
  private readonly refundOrderLookup: RefundOrderLookup;

  public constructor(input?: { refundOrderLookup?: RefundOrderLookup }) {
    this.refundOrderLookup = input?.refundOrderLookup ?? new RefundRepository();
  }

  canHandle(context: OrderFetchContext): boolean {
    return Boolean(context.orderSignal?.orderId);
  }

  async fetch(context: OrderFetchContext): Promise<RefundOrdersFetchResult> {
    const orderId = context.orderSignal?.orderId?.trim();
    if (!orderId) {
      throw new Error('Order id is required');
    }

    const refundedOrderIds = new Set(
      await this.refundOrderLookup.getRefundedOrderIdsByBuyer(context.buyerId),
    );

    if (refundedOrderIds.has(orderId)) {
      return { orders: [] };
    }

    const detail: BuyerOrderDetailResult = await getBuyerOrderById(context.buyerId, orderId);

    return {
      orders: [toRefundOrderCard(detail.order, detail.items)],
    };
  }
}

export function selectOrderFetchStrategy(
  strategies: OrderFetchStrategy[],
  context: OrderFetchContext,
) {
  const selected = strategies.find((strategy) => strategy.canHandle(context));
  if (!selected) {
    throw new Error('No order fetch strategy available');
  }

  return selected;
}
