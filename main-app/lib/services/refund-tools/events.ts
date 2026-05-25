import type { RefundOrderCard } from '@/lib/services/refund-tools/types';
import type { RefundToolErrorDetails } from '@/lib/services/refund-tools/types';

export type RefundToolEvent =
  | {
      type: 'orders_fetched';
      buyerId: string;
      count: number;
      orders: RefundOrderCard[];
      timestamp: number;
    }
  | {
      type: 'orders_fetch_failed';
      buyerId: string;
      error: { code: string; message: string; details: RefundToolErrorDetails };
      timestamp: number;
    }
  | {
      type: 'refund_submitted';
      buyerId: string;
      orderId: string;
      refundId: string;
      refundNumber: string;
      timestamp: number;
    }
  | {
      type: 'refund_failed';
      buyerId: string;
      orderId?: string;
      error: { code: string; message: string; details: RefundToolErrorDetails };
      timestamp: number;
    };

export type RefundToolEventType = RefundToolEvent['type'];

type Listener = (event: RefundToolEvent) => void;

export class RefundToolEventEmitter {
  private readonly listeners = new Map<RefundToolEventType, Set<Listener>>();

  on(type: RefundToolEventType, listener: Listener): () => void {
    const set = this.listeners.get(type) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(type, set);

    return () => this.off(type, listener);
  }

  off(type: RefundToolEventType, listener: Listener): void {
    const set = this.listeners.get(type);
    if (!set) {
      return;
    }

    set.delete(listener);
    if (set.size === 0) {
      this.listeners.delete(type);
    }
  }

  emit(event: RefundToolEvent): void {
    const set = this.listeners.get(event.type);
    if (!set) {
      return;
    }

    set.forEach((listener) => listener(event));
  }
}

let defaultEmitter: RefundToolEventEmitter | null = null;

export function getRefundToolEventEmitter(): RefundToolEventEmitter {
  if (!defaultEmitter) {
    defaultEmitter = new RefundToolEventEmitter();
  }

  return defaultEmitter;
}
