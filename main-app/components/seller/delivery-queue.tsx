'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export type DeliveryQueueItem = {
  orderItemId: string;
  orderId: string;
  orderNumber: string;
  productName: string;
  customerName: string;
  status: string;
  createdAt: string;
};

type DeliveryQueueProps = {
  items: DeliveryQueueItem[];
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US');
}

export function DeliveryQueue({ items }: DeliveryQueueProps) {
  const [queue, setQueue] = useState(items);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async (orderItemId: string) => {
    setError(null);
    setBusyId(orderItemId);

    try {
      const response = await fetch(`/api/seller/order-items/${orderItemId}/deliver`, {
        method: 'POST',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? 'Unable to confirm delivery.');
      }

      setQueue((current) => current.filter((item) => item.orderItemId !== orderItemId));
    } catch (fetchError) {
      if (fetchError instanceof Error) {
        setError(fetchError.message);
      } else {
        setError('Unable to confirm delivery.');
      }
    } finally {
      setBusyId(null);
    }
  };

  if (queue.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/30 px-6 py-10 text-center text-sm text-muted-foreground">
        No items waiting for delivery confirmation.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      <div className="space-y-3">
        {queue.map((item) => (
          <div
            key={item.orderItemId}
            className="rounded-lg border px-4 py-4 shadow-sm sm:flex sm:items-center sm:justify-between"
          >
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">{item.productName}</p>
              <p className="text-xs text-muted-foreground">
                Order {item.orderNumber} · {item.customerName}
              </p>
              <p className="text-xs text-muted-foreground">Placed {formatDate(item.createdAt)}</p>
            </div>
            <div className="mt-3 flex items-center gap-3 sm:mt-0">
              <Badge className="border-amber-200 bg-amber-100 text-amber-700">
                {item.status}
              </Badge>
              <Button
                size="sm"
                onClick={() => handleConfirm(item.orderItemId)}
                disabled={busyId === item.orderItemId}
              >
                {busyId === item.orderItemId ? 'Confirming...' : 'Confirm Delivery'}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
