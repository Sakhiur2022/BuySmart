'use client';

import { useCallback, useMemo, useState } from 'react';

import type { BuyerIntentError } from '@/lib/chatbot/buyer-intent/errors';
import type { RefundOrderCard } from '@/lib/services/refund-tools/types';

export type RefundToolStage =
  | 'idle'
  | 'fetching-orders'
  | 'awaiting-order-selection'
  | 'submitting-refund'
  | 'refund-confirmed'
  | 'refund-failed';

export type RefundToolStatusState = {
  stage: RefundToolStage;
  orders: RefundOrderCard[];
  refundReferenceId: string | null;
  error: BuyerIntentError | null;
};

export function useRefundToolStatus(initialStage: RefundToolStage = 'idle') {
  const [stage, setStage] = useState<RefundToolStage>(initialStage);
  const [orders, setOrders] = useState<RefundOrderCard[]>([]);
  const [refundReferenceId, setRefundReferenceId] = useState<string | null>(null);
  const [error, setError] = useState<BuyerIntentError | null>(null);

  const updateStage = useCallback((next: RefundToolStage) => {
    setStage(next);
    if (next !== 'refund-failed') {
      setError(null);
    }
  }, []);

  const updateOrders = useCallback((nextOrders: RefundOrderCard[]) => {
    setOrders(nextOrders);
  }, []);

  const confirmRefund = useCallback((referenceId: string) => {
    setRefundReferenceId(referenceId);
    setStage('refund-confirmed');
    setError(null);
  }, []);

  const fail = useCallback((nextError: BuyerIntentError) => {
    setError(nextError);
    setStage('refund-failed');
  }, []);

  const reset = useCallback(() => {
    setStage('idle');
    setOrders([]);
    setRefundReferenceId(null);
    setError(null);
  }, []);

  const state: RefundToolStatusState = useMemo(
    () => ({ stage, orders, refundReferenceId, error }),
    [stage, orders, refundReferenceId, error],
  );

  return {
    ...state,
    updateStage,
    updateOrders,
    confirmRefund,
    fail,
    reset,
  };
}
