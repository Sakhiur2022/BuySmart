'use client';

import { useCallback, useMemo, useState } from 'react';

import type { RefundOrderCard } from '@/lib/services/refund-tools/types';

export function useOrderCardSelection(initialOrder: RefundOrderCard | null = null) {
  const [selectedOrder, setSelectedOrder] = useState<RefundOrderCard | null>(initialOrder);

  const select = useCallback((order: RefundOrderCard) => {
    setSelectedOrder(order);
  }, []);

  const clear = useCallback(() => {
    setSelectedOrder(null);
  }, []);

  return useMemo(
    () => ({
      selectedOrderId: selectedOrder?.order_id ?? null,
      selectedOrder,
      select,
      clear,
    }),
    [selectedOrder, select, clear],
  );
}
