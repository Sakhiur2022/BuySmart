import { describe, expect, it, vi } from 'vitest';

import {
  RecentOrdersStrategy,
  SpecificOrderStrategy,
} from '@/lib/services/refund-tools/order-fetch-strategies';
import { getBuyerOrderById, getBuyerOrders } from '@/lib/services/order.service';
import { fetchOrderItemsByOrderId } from '@/lib/repositories/order.repository';
import type { Order } from '@/lib/models/order.model';

vi.mock('@/lib/services/order.service', () => ({
  getBuyerOrders: vi.fn(),
  getBuyerOrderById: vi.fn(),
}));

vi.mock('@/lib/repositories/order.repository', () => ({
  fetchOrderItemsByOrderId: vi.fn(),
}));

const order = {
  order_id: 'd1c4e1d8-4e20-4cd9-9d70-2e70c2ed11c1',
  order_number: 'ORD-123',
  created_at: new Date().toISOString(),
  status: 'delivered',
  total_amount: 120,
  currency: 'USD',
} as unknown as Order;

describe('Order fetch strategies', () => {
  it('returns recent orders for the buyer', async () => {
    vi.mocked(getBuyerOrders).mockResolvedValue({
      orders: [order],
      pagination: { page: 1, pageSize: 5, totalCount: 1, totalPages: 1 },
    });
    vi.mocked(fetchOrderItemsByOrderId).mockResolvedValue([]);

    const refundLookup = {
      getRefundedOrderIdsByBuyer: vi.fn().mockResolvedValue([]),
    };

    const strategy = new RecentOrdersStrategy({ refundOrderLookup: refundLookup });
    const result = await strategy.fetch({
      buyerId: 'buyer-1',
      orderSignal: { recentOrders: true },
    });

    expect(getBuyerOrders).toHaveBeenCalled();
    expect(refundLookup.getRefundedOrderIdsByBuyer).toHaveBeenCalledWith('buyer-1');
    expect(result.orders).toHaveLength(1);
  });

  it('returns the specific order by id', async () => {
    const refundLookup = {
      getRefundedOrderIdsByBuyer: vi.fn().mockResolvedValue([]),
    };

    vi.mocked(getBuyerOrderById).mockResolvedValue({
      order,
      items: [],
      feedbackByOrderItemId: {},
    });

    const strategy = new SpecificOrderStrategy({ refundOrderLookup: refundLookup });
    const result = await strategy.fetch({
      buyerId: 'buyer-1',
      orderSignal: { orderId: order.order_id },
    });

    expect(refundLookup.getRefundedOrderIdsByBuyer).toHaveBeenCalledWith('buyer-1');
    expect(getBuyerOrderById).toHaveBeenCalledWith('buyer-1', order.order_id);
    expect(result.orders).toHaveLength(1);
  });

  it('omits orders that already have a submitted refund request', async () => {
    vi.mocked(getBuyerOrders).mockResolvedValue({
      orders: [order],
      pagination: { page: 1, pageSize: 5, totalCount: 1, totalPages: 1 },
    });

    const refundLookup = {
      getRefundedOrderIdsByBuyer: vi.fn().mockResolvedValue([order.order_id]),
    };

    const strategy = new RecentOrdersStrategy({ refundOrderLookup: refundLookup });
    const result = await strategy.fetch({
      buyerId: 'buyer-1',
      orderSignal: { recentOrders: true },
    });

    expect(result.orders).toHaveLength(0);
    expect(fetchOrderItemsByOrderId).not.toHaveBeenCalled();
  });

  it('omits a specific order card when a refund has already been submitted', async () => {
    const refundLookup = {
      getRefundedOrderIdsByBuyer: vi.fn().mockResolvedValue([order.order_id]),
    };

    const strategy = new SpecificOrderStrategy({ refundOrderLookup: refundLookup });
    const result = await strategy.fetch({
      buyerId: 'buyer-1',
      orderSignal: { orderId: order.order_id },
    });

    expect(result.orders).toHaveLength(0);
    expect(getBuyerOrderById).not.toHaveBeenCalled();
  });
});
