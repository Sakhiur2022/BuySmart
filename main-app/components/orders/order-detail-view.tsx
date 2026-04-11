import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/lib/utils';
import type { Order, OrderItem, OrderStatus } from '@/lib/models/order.model';
import { CheckCircle2, Circle, Clock3, Package, Truck, XCircle } from 'lucide-react';

type ParsedAddress = {
  full_name: string;
  phone: string;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string | null;
  postal_code: string | null;
  country: string;
};

type ParsedSnapshot = {
  name: string;
  short_description: string | null;
  image: string | null;
};

type TimelineStep = {
  key: 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'completed';
  label: string;
  description: string;
  happenedAt: string | null;
};

const ORDER_PROGRESS: Array<TimelineStep['key']> = [
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'completed',
];

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function formatDateTime(value: string | null): string {
  if (!value) {
    return 'Not available';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Not available';
  }

  return new Intl.DateTimeFormat('en-BD', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

function parseAddress(value: unknown): ParsedAddress | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;

  const fullName = typeof candidate.full_name === 'string' ? candidate.full_name : '';
  const phone = typeof candidate.phone === 'string' ? candidate.phone : '';
  const addressLine1 = typeof candidate.address_line_1 === 'string' ? candidate.address_line_1 : '';
  const city = typeof candidate.city === 'string' ? candidate.city : '';
  const country = typeof candidate.country === 'string' ? candidate.country : '';

  if (!fullName || !phone || !addressLine1 || !city || !country) {
    return null;
  }

  return {
    full_name: fullName,
    phone,
    address_line_1: addressLine1,
    address_line_2:
      typeof candidate.address_line_2 === 'string' && candidate.address_line_2.length > 0
        ? candidate.address_line_2
        : null,
    city,
    state: typeof candidate.state === 'string' && candidate.state.length > 0 ? candidate.state : null,
    postal_code:
      typeof candidate.postal_code === 'string' && candidate.postal_code.length > 0
        ? candidate.postal_code
        : null,
    country,
  };
}

function parseSnapshot(value: unknown): ParsedSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      name: 'Unnamed item',
      short_description: null,
      image: null,
    };
  }

  const candidate = value as Record<string, unknown>;

  return {
    name: typeof candidate.name === 'string' && candidate.name.length > 0 ? candidate.name : 'Unnamed item',
    short_description:
      typeof candidate.short_description === 'string' && candidate.short_description.length > 0
        ? candidate.short_description
        : null,
    image: typeof candidate.image === 'string' && candidate.image.length > 0 ? candidate.image : null,
  };
}

function getTimelineSteps(order: Order): TimelineStep[] {
  return [
    {
      key: 'confirmed',
      label: 'Order confirmed',
      description: 'Your purchase is recorded and awaiting fulfillment.',
      happenedAt: order.created_at,
    },
    {
      key: 'processing',
      label: 'Processing',
      description: 'Sellers are preparing your items.',
      happenedAt:
        order.status === 'processing' ||
        order.status === 'shipped' ||
        order.status === 'delivered' ||
        order.status === 'completed'
          ? order.updated_at
          : null,
    },
    {
      key: 'shipped',
      label: 'Shipped',
      description: 'Parcel has left the seller and is in transit.',
      happenedAt: order.shipped_at,
    },
    {
      key: 'delivered',
      label: 'Delivered',
      description: 'The package reached your address.',
      happenedAt: order.delivered_at,
    },
    {
      key: 'completed',
      label: 'Completed',
      description: 'Order lifecycle is completed.',
      happenedAt: order.completed_at,
    },
  ];
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

function ItemStatusBadge({ status }: { status: OrderItem['status'] }) {
  const normalized = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <Badge variant="outline" className="font-medium">
      {normalized}
    </Badge>
  );
}

export function OrderDetailView({ order, items }: { order: Order; items: OrderItem[] }) {
  const statusLabel = ORDER_STATUS_LABELS[order.status] ?? order.status;
  const steps = getTimelineSteps(order);
  const currentStepIndex = ORDER_PROGRESS.indexOf(order.status as TimelineStep['key']);
  const shippingAddress = parseAddress(order.shipping_address);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Order details</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">#{order.order_number}</h1>
          <p className="text-sm text-muted-foreground">
            Placed on {formatDateTime(order.created_at)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={getStatusBadgeClasses(order.status)}>
            {statusLabel}
          </Badge>
          <Badge variant="secondary">Payment: {order.payment_status}</Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Status timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {order.status === 'cancelled' ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-700">
                <div className="flex items-start gap-3">
                  <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div className="space-y-1">
                    <p className="font-semibold">Order cancelled</p>
                    <p>
                      {order.cancellation_reason ?? 'This order was cancelled before completion.'}
                    </p>
                    <p className="text-xs text-red-700/80">
                      Cancelled at: {formatDateTime(order.cancelled_at)}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <ol className="space-y-4">
              {steps.map((step, index) => {
                const reached = order.status === 'cancelled' ? Boolean(step.happenedAt) : index <= currentStepIndex;
                const isCurrent = order.status !== 'cancelled' && index === currentStepIndex;

                return (
                  <li key={step.key} className="relative flex gap-3">
                    <div className="pt-0.5">
                      {reached ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      ) : isCurrent ? (
                        <Clock3 className="h-5 w-5 text-amber-600" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">{step.label}</p>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {step.happenedAt ? formatDateTime(step.happenedAt) : 'Pending'}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Order summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatCurrency(order.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span className="font-medium">{formatCurrency(order.shipping_amount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span className="font-medium">{formatCurrency(order.tax_amount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Discount</span>
              <span className="font-medium">-{formatCurrency(order.discount_amount)}</span>
            </div>

            <Separator />

            <div className="flex items-center justify-between text-base font-semibold">
              <span>Total</span>
              <span>{formatCurrency(order.total_amount)}</span>
            </div>

            {shippingAddress ? (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Shipping address</p>
                  <div className="space-y-1 text-muted-foreground">
                    <p>{shippingAddress.full_name}</p>
                    <p>{shippingAddress.phone}</p>
                    <p>{shippingAddress.address_line_1}</p>
                    {shippingAddress.address_line_2 ? <p>{shippingAddress.address_line_2}</p> : null}
                    <p>
                      {shippingAddress.city}
                      {shippingAddress.state ? `, ${shippingAddress.state}` : ''}
                      {shippingAddress.postal_code ? ` ${shippingAddress.postal_code}` : ''}
                    </p>
                    <p>{shippingAddress.country}</p>
                  </div>
                </div>
              </>
            ) : null}

            {order.tracking_number ? (
              <>
                <Separator />
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Tracking</p>
                  <p className="font-mono text-xs text-muted-foreground">{order.tracking_number}</p>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Items ({items.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No items found for this order.</p>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => {
                const snapshot = parseSnapshot(item.product_snapshot);

                return (
                  <li
                    key={item.order_item_id}
                    className="rounded-xl border bg-card/60 p-4 transition-colors hover:bg-card"
                  >
                    <div className="flex gap-4">
                      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border bg-muted/40">
                        {snapshot.image ? (
                          <Image
                            src={snapshot.image}
                            alt={snapshot.name}
                            fill
                            sizes="80px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-muted-foreground">
                            <Package className="h-5 w-5" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold leading-tight">{snapshot.name}</p>
                            {snapshot.short_description ? (
                              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                                {snapshot.short_description}
                              </p>
                            ) : null}
                          </div>
                          <ItemStatusBadge status={item.status} />
                        </div>

                        <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                          <p>Qty: {item.quantity}</p>
                          <p>Unit: {formatCurrency(item.unit_price)}</p>
                          <p className="font-medium text-foreground">
                            Line total: {formatCurrency(item.total_price)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link href="/buyer">Continue shopping</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/profile">Account settings</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/buyer/cart">
            <Truck className="mr-2 h-4 w-4" />
            Buy again
          </Link>
        </Button>
      </div>
    </div>
  );
}