import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/server';
import { getBuyerOrders } from '@/lib/services/order.service';
import { formatCurrency } from '@/lib/utils';
import type { OrderStatus } from '@/lib/models/order.model';

const ORDER_STATUS_OPTIONS: Array<{ value: OrderStatus; label: string }> = [
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PAGE_SIZE = 10;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type BuyerOrdersPageProps = {
  searchParams?: Promise<{
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: string;
    pageSize?: string;
  }>;
};

function parseOptionalNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

function normalizeDateInput(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim();
  if (!normalized || !DATE_PATTERN.test(normalized)) {
    return undefined;
  }

  return normalized;
}

function resolveStatus(value: string | undefined): OrderStatus | undefined {
  if (!value) {
    return undefined;
  }

  const matches = ORDER_STATUS_OPTIONS.find((option) => option.value === value);
  return matches?.value;
}

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

function buildHref(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      search.set(key, value);
    }
  });

  const query = search.toString();
  return query ? `/buyer/orders?${query}` : '/buyer/orders';
}

export default async function BuyerOrdersPage({ searchParams }: BuyerOrdersPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const params = await searchParams;
  const status = resolveStatus(params?.status);
  const dateFrom = normalizeDateInput(params?.dateFrom);
  const dateTo = normalizeDateInput(params?.dateTo);
  const page = parseOptionalNumber(params?.page, 1);
  const pageSize = parseOptionalNumber(params?.pageSize, PAGE_SIZE);

  const result = await getBuyerOrders(user.id, {
    page,
    pageSize,
    status,
    dateFrom,
    dateTo,
  });

  const totalPages = result.pagination.totalPages;
  const previousPage = page > 1 ? page - 1 : null;
  const nextPage = page < totalPages ? page + 1 : null;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">Order history</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Review past purchases, filter by date or status, and track order progress.
          </p>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_auto]" method="get">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="status">
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={status ?? ''}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
              >
                <option value="">All statuses</option>
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
              <Input id="dateFrom" name="dateFrom" type="date" defaultValue={dateFrom} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="dateTo">
                To date
              </label>
              <Input id="dateTo" name="dateTo" type="date" defaultValue={dateTo} />
            </div>

            <div className="flex items-end gap-2">
              <Button type="submit" size="sm">
                Apply
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/buyer/orders">Clear</Link>
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
          {result.orders.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-muted/30 px-6 py-10 text-center text-sm text-muted-foreground">
              No orders match these filters yet.
            </div>
          ) : (
            <div className="space-y-4">
              {result.orders.map((order) => (
                <div
                  key={order.order_id}
                  className="rounded-lg border px-4 py-4 shadow-sm sm:flex sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">#{order.order_number}</p>
                    <p className="text-xs text-muted-foreground">Placed {formatDate(order.created_at)}</p>
                    <p className="text-xs text-muted-foreground">Payment: {order.payment_status}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 sm:mt-0">
                    <Badge variant="outline" className={getStatusBadgeClasses(order.status)}>
                      {order.status}
                    </Badge>
                    <span className="text-sm font-semibold text-foreground">
                      {formatCurrency(order.total_amount)}
                    </span>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/buyer/orders/${order.order_id}`}>View details</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Page {result.pagination.page} of {result.pagination.totalPages}
        </p>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" disabled={!previousPage}>
            <Link
              href={
                previousPage
                  ? buildHref({
                      status,
                      dateFrom,
                      dateTo,
                      page: String(previousPage),
                      pageSize: String(pageSize),
                    })
                  : '#'
              }
            >
              Previous
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" disabled={!nextPage}>
            <Link
              href={
                nextPage
                  ? buildHref({
                      status,
                      dateFrom,
                      dateTo,
                      page: String(nextPage),
                      pageSize: String(pageSize),
                    })
                  : '#'
              }
            >
              Next
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
