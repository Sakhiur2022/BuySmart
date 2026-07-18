'use client';

import { useEffect, useState } from 'react';
import type { Order } from '@/lib/chatbot/types';
import { createClient } from '@/lib/supabase/client';

export function useOrderRetrieval(orderId?: string, userId?: string) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = async () => {
    if (!orderId) {
      setError('Order ID is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      
      let query = supabase
        .from('orders')
        .select(`
          order_id,
          order_number,
          status,
          created_at,
          buyer_id,
          total_amount,
          shipping_address,
          tracking_number,
          payment_status,
          order_items (
            order_item_id,
            product_id,
            quantity,
            unit_price,
            total_price,
            status,
            products (
              name,
              images
            )
          )
        `)
        .eq('order_id', orderId);

      // If userId is provided, ensure the order belongs to the user (auth check)
      if (userId) {
        query = query.eq('buyer_id', userId);
      }

      const { data, error: fetchError } = await query.single();

      if (fetchError) {
        throw fetchError;
      }

      if (!data) {
        setOrder(null);
        return;
      }

      // Transform Supabase data to Order format
      const transformedOrder: Order = {
        id: data.order_id,
        status: data.status as Order['status'],
        created_at: data.created_at,
        buyer_id: data.buyer_id,
        items: data.order_items?.map((item: any) => ({
          id: item.order_item_id,
          name: item.products?.name || 'Unknown Product',
          quantity: item.quantity,
          price: item.unit_price,
        })) || [],
      };

      setOrder(transformedOrder);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to retrieve order';
      setError(errorMessage);
      console.error('Order retrieval error:', err);
      
      // If the error is due to unauthorized access, provide a specific message
      if (errorMessage.includes('Rows not found') || errorMessage.includes('PGRST116')) {
        setError('Order not found or access denied');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [orderId, userId]);

  return { order, loading, error, refetch: fetchOrder };
}

// Additional hook for fetching multiple orders for a user
export function useUserOrders(userId?: string, limit: number = 10) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUserOrders = async () => {
    if (!userId) {
      setError('User ID is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select(`
          order_id,
          order_number,
          status,
          created_at,
          buyer_id,
          total_amount,
          tracking_number,
          payment_status,
          order_items (
            order_item_id,
            product_id,
            quantity,
            unit_price,
            total_price,
            products (
              name
            )
          )
        `)
        .eq('buyer_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (fetchError) {
        throw fetchError;
      }

      if (!data || data.length === 0) {
        setOrders([]);
        return;
      }

      // Transform Supabase data to Order format
      const transformedOrders: Order[] = data.map((item: any) => ({
        id: item.order_id,
        status: item.status as Order['status'],
        created_at: item.created_at,
        buyer_id: item.buyer_id,
        items: item.order_items?.map((orderItem: any) => ({
          id: orderItem.order_item_id,
          name: orderItem.products?.name || 'Unknown Product',
          quantity: orderItem.quantity,
          price: orderItem.unit_price,
        })) || [],
      }));

      setOrders(transformedOrders);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to retrieve orders';
      setError(errorMessage);
      console.error('User orders retrieval error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserOrders();
  }, [userId, limit]);

  return { orders, loading, error, refetch: fetchUserOrders };
}