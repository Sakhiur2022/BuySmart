'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/utils';
import type { BuyerOrderWithItemStatuses, OrderItemStatus, OrderStatus } from '@/lib/models/order.model';

type BuyerOrdersClientProps = {
  orders: BuyerOrderWithItemStatuses[];
  pageSize: number;
};

const ORDER_STATUS_OPTIONS: Array<{ value: OrderStatus; label: string }> = [
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown date';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}

function getStatusBadgeClasses(status: OrderStatus): string {
  if (status === 'cancelled') {
    return 'bg-red-500/10 text-red-700 border-red-500/20';
  }

  if (status === 'completed') {
    return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
  }

  if (status === 'shipped' || status === 'delivered') {
    return 'bg-blue-500/10 text-blue-700 border-blue-500/20';
  }

  return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
}

function getLocalDateString(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function mapItemStatusToOrderStatus(value: OrderItemStatus | null): OrderStatus | null {
  if (!value) {
    return null;
  }

  switch (value) {
    case 'cancelled':
      return 'cancelled';
    case 'returned':
      return 'cancelled';
    case 'pending':
      return 'confirmed';
    case 'confirmed':
      return 'confirmed';
    case 'shipped':
      return 'shipped';
    case 'delivered':
      return 'delivered';
    default:
      return null;
  }
}

function getWorstCaseOrderStatus(itemStatuses: Array<OrderItemStatus | null>): OrderStatus | null {
  const priority: Record<OrderStatus, number> = {
    draft: 0,
    cancelled: 0,
    confirmed: 1,
    processing: 2,
    shipped: 3,
    delivered: 4,
    completed: 5,
  };

  let worst: OrderStatus | null = null;

  itemStatuses.forEach((status) => {
    const mapped = mapItemStatusToOrderStatus(status);
    if (!mapped) {
      return;
    }

    if (!worst || priority[mapped] < priority[worst]) {
      worst = mapped;
    }
  });

  return worst;
}

function deriveOrderStatus(order: BuyerOrderWithItemStatuses): OrderStatus {
  const itemStatuses = (order.order_items ?? []).map((item) => item.status ?? null);
  return getWorstCaseOrderStatus(itemStatuses) ?? order.status;
}

function parseDateInput(value: string, isEnd: boolean): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  if (isEnd) {
    parsed.setHours(23, 59, 59, 999);
  } else {
    parsed.setHours(0, 0, 0, 0);
  }

  return parsed;
}

export default function BuyerOrdersClient({ orders, pageSize }: BuyerOrdersClientProps) {
  const maxDate = useMemo(() => getLocalDateString(), []);
  const [status, setStatus] = useState<OrderStatus | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  const filteredOrders = useMemo(() => {
    const fromDate = parseDateInput(dateFrom, false);
    const toDate = parseDateInput(dateTo, true);

    return orders.filter((order) => {
      const derivedStatus = deriveOrderStatus(order);
      if (status !== 'all' && derivedStatus !== status) {
        return false;
      }

      const createdAt = new Date(order.created_at);
      if (fromDate && createdAt < fromDate) {
        return false;
      }

      if (toDate && createdAt > toDate) {
        return false;
      }

      return true;
    });
  }, [orders, status, dateFrom, dateTo]);

  const totalPages = filteredOrders.length > 0 ? Math.ceil(filteredOrders.length / pageSize) : 0;
  const startIndex = (page - 1) * pageSize;
  const pageOrders = filteredOrders.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    setPage(1);
  }, [status, dateFrom, dateTo]);

  useEffect(() => {
    if (totalPages === 0) {
      setPage(1);
      return;
    }

    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_auto]"
            onSubmit={(event) => event.preventDefault()}
          >
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="status">
                Status
              </label>
              <select
                id="status"
                name="status"
                value={status}
                onChange={(event) => setStatus(event.target.value as OrderStatus | 'all')}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
              >
                <option value="all">All statuses</option>
                {ORDER_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="dateFrom">
                From date
              </label>
              <Input
                id="dateFrom"
                name="dateFrom"
                type="date"
                max={maxDate}
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="dateTo">
                To date
              </label>
              <Input
                id="dateTo"
                name="dateTo"
                type="date"
                max={maxDate}
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </div>

            <div className="flex items-end gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setStatus('all');
                  setDateFrom('');
                  setDateTo('');
                }}
              >
                Clear
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {pageOrders.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-muted/30 px-6 py-10 text-center text-sm text-muted-foreground">
              No orders match these filters yet.
            </div>
          ) : (
            <div className="space-y-4">
              {pageOrders.map((order) => {
                const derivedStatus = deriveOrderStatus(order);

                return (
                  <div
                    key={order.order_id}
                    className="rounded-lg border px-4 py-4 shadow-sm sm:flex sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">#{order.order_number}</p>
                      <p className="text-xs text-muted-foreground">Placed {formatDate(order.created_at)}</p>
                      <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        {order.payment_status === 'paid' ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        ) : null}
                        <span>Payment: {order.payment_status}</span>
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3 sm:mt-0">
                      <Badge variant="outline" className={getStatusBadgeClasses(derivedStatus)}>
                        {derivedStatus}
                      </Badge>
                      <span className="text-sm font-semibold text-foreground">
                        {formatCurrency(order.total_amount)}
                      </span>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/buyer/orders/${order.order_id}`}>View details</Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Page {totalPages === 0 ? 0 : page} of {totalPages}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={totalPages === 0 || page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </>
  );
}
