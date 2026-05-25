'use client';

import { useEffect, useMemo, useState } from 'react';

import type { RefundToolEvent } from '@/lib/services/refund-tools/events';
import { getRefundToolEventEmitter } from '@/lib/services/refund-tools/events';
import type { RefundToolErrorDetails } from '@/lib/services/refund-tools/types';

export type MascotRefundFallbackState = {
  active: boolean;
  errorCode?: string;
  message?: string;
  details?: RefundToolErrorDetails;
};

export function useMascotRefundFallback() {
  const [state, setState] = useState<MascotRefundFallbackState>({ active: false });

  useEffect(() => {
    const emitter = getRefundToolEventEmitter();

    const handler = (event: RefundToolEvent) => {
      if (!('error' in event)) {
        return;
      }

      if (!event.error.details?.mascotTrigger) {
        return;
      }

      setState({
        active: true,
        errorCode: event.error.code,
        message: event.error.message,
        details: event.error.details,
      });
    };

    const offRefundFailed = emitter.on('refund_failed', handler);
    const offOrdersFailed = emitter.on('orders_fetch_failed', handler);

    return () => {
      offRefundFailed();
      offOrdersFailed();
    };
  }, []);

  const reset = () => {
    setState({ active: false });
  };

  return useMemo(() => ({ ...state, reset }), [state]);
}
