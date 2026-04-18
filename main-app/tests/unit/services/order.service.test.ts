import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/repositories/order.repository', () => ({
  createOrder: vi.fn(),
  createOrderItems: vi.fn(),
  decreaseProductInventory: vi.fn(),
  deleteOrder: vi.fn(),
  fetchBuyerOrdersWithItemStatuses: vi.fn(),
  fetchBuyerOrdersPaginated: vi.fn(),
  fetchCartByUserId: vi.fn(),
  fetchCartItems: vi.fn(),
  fetchBuyerFeedbackByOrderItemIds: vi.fn(),
  fetchBuyerOrderCountByStatus: vi.fn(),
  fetchBuyerDeliveredCountByDateRange: vi.fn(),
  fetchOrderByIdForBuyer: vi.fn(),
  fetchOrderItemsByOrderId: vi.fn(),
  fetchProductsByIds: vi.fn(),
  fetchUserRole: vi.fn(),
  removeCartItems: vi.fn(),
}));

import {
  createOrder,
  createOrderItems,
  decreaseProductInventory,
  fetchBuyerFeedbackByOrderItemIds,
  fetchBuyerOrdersWithItemStatuses,
  fetchOrderByIdForBuyer,
  fetchOrderItemsByOrderId,
  fetchProductsByIds,
  fetchUserRole,
} from '@/lib/repositories/order.repository';
import {
  createOrderFromInput,
  getBuyerOrderById,
  getBuyerOrders,
} from '@/lib/services/order.service';

describe('order.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchUserRole).mockResolvedValue('buyer');
  });

  it('creates order from direct items and decreases inventory', async () => {
    vi.mocked(fetchProductsByIds).mockResolvedValue([
      {
        product_id: 'p-1',
        seller_id: 'seller-1',
        name: 'Demo Product',
        short_description: 'desc',
        images: ['https://example.com/demo.jpg'],
        status: 'active',
        inventory_quantity: 50,
        price: 120,
      },
    ] as never);

    vi.mocked(createOrder).mockResolvedValue({
      order_id: 'ord-1',
      buyer_id: 'buyer-1',
      status: 'confirmed',
    } as never);

    vi.mocked(createOrderItems).mockResolvedValue([
      {
        order_item_id: 'item-1',
        order_id: 'ord-1',
        product_id: 'p-1',
        quantity: 2,
      },
    ] as never);

    const result = await createOrderFromInput('buyer-1', {
      source: 'direct',
      items: [{ product_id: 'p-1', quantity: 2 }],
      shipping_address: {
        full_name: 'Sakhiur Rahman',
        phone: '+8801712345678',
        address_line_1: 'Dhaka',
        city: 'Dhaka',
        country: 'BD',
      },
    });

    expect(decreaseProductInventory).toHaveBeenCalledWith('p-1', 2);
    expect(createOrder).toHaveBeenCalledTimes(1);
    expect(createOrderItems).toHaveBeenCalledTimes(1);
    expect(result.items).toHaveLength(1);
    expect(result.skipped_items).toHaveLength(0);
  });

  it('fails when no valid items are available', async () => {
    await expect(
      createOrderFromInput('buyer-1', {
        source: 'direct',
        items: [{ product_id: '   ', quantity: 0 }],
      }),
    ).rejects.toThrow('No items available to create order');
  });

  it('filters buyer orders by derived status when status filter is provided', async () => {
    vi.mocked(fetchBuyerOrdersWithItemStatuses).mockResolvedValue([
      {
        order_id: 'ord-1',
        status: 'processing',
        order_items: [{ status: 'shipped' }, { status: 'confirmed' }],
      },
      {
        order_id: 'ord-2',
        status: 'processing',
        order_items: [{ status: 'delivered' }],
      },
    ] as never);

    const result = await getBuyerOrders('buyer-1', {
      status: 'confirmed',
      page: 1,
      pageSize: 10,
    });

    expect(result.orders).toHaveLength(1);
    expect(result.orders[0].order_id).toBe('ord-1');
    expect(result.pagination.totalCount).toBe(1);
  });

  it('returns order detail with feedback map keyed by order item id', async () => {
    vi.mocked(fetchOrderByIdForBuyer).mockResolvedValue({
      order_id: 'ord-1',
      order_number: 'ORD-001',
      status: 'delivered',
    } as never);
    vi.mocked(fetchOrderItemsByOrderId).mockResolvedValue([
      {
        order_item_id: 'item-1',
        status: 'delivered',
      },
      {
        order_item_id: 'item-2',
        status: 'delivered',
      },
    ] as never);
    vi.mocked(fetchBuyerFeedbackByOrderItemIds).mockResolvedValue([
      {
        feedback_id: 'fb-1',
        order_item_id: 'item-1',
        status: 'published',
      },
    ] as never);

    const result = await getBuyerOrderById('buyer-1', 'ord-1');

    expect(result.feedbackByOrderItemId).toEqual({
      'item-1': {
        feedback_id: 'fb-1',
        status: 'published',
      },
    });
  });
});
