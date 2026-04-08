import Link from 'next/link';
import { CheckCircle2, Package, Truck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type OrderConfirmationPageProps = {
  searchParams?: Promise<{
    order?: string | string[];
    orderNumber?: string | string[];
    order_id?: string | string[];
    order_number?: string | string[];
  }>;
};

function getSearchValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function isUuid(value: string | null): boolean {
  if (!value) {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export default async function OrderConfirmationPage({
  searchParams,
}: OrderConfirmationPageProps) {
  const resolvedSearchParams = await searchParams;
  const orderId =
    getSearchValue(resolvedSearchParams?.order_id) ?? getSearchValue(resolvedSearchParams?.order);
  const orderNumber =
    getSearchValue(resolvedSearchParams?.orderNumber) ??
    getSearchValue(resolvedSearchParams?.order_number) ??
    getSearchValue(resolvedSearchParams?.order) ??
    getSearchValue(resolvedSearchParams?.order_id);

  return (
    <div className="relative overflow-hidden rounded-3xl border bg-linear-to-br from-primary/5 via-background to-background p-6 shadow-xl shadow-primary/10 sm:p-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(230,57,70,0.15),transparent_65%)]"
      />
      <div className="relative space-y-8">
        <div className="flex flex-col gap-4">
          <Badge className="w-fit bg-emerald-500/10 text-emerald-700">Order confirmed</Badge>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">
                Thank you for your purchase!
              </h1>
              <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                We are getting your order ready and will send updates as it moves.
              </p>
            </div>
          </div>
        </div>

        <Card className="border-emerald-500/20 bg-emerald-500/5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700">
                Order number
              </p>
              <p className="mt-2 text-lg font-semibold tracking-tight">
                {orderNumber ? `#${orderNumber}` : 'Pending assignment'}
              </p>
            </div>
            <div className="rounded-full border border-emerald-500/20 bg-background/80 px-4 py-2 text-xs text-muted-foreground">
              A confirmation email is on the way.
            </div>
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              title: 'Packed with care',
              description: 'We are picking the best items from our sellers.',
              Icon: Package,
            },
            {
              title: 'Ready to ship',
              description: 'Shipping labels will be issued within 24 hours.',
              Icon: Truck,
            },
            {
              title: 'Delivered to you',
              description: 'Track the status from your buyer dashboard.',
              Icon: CheckCircle2,
            },
          ].map(({ title, description, Icon }) => (
            <div key={title} className="rounded-2xl border bg-background/80 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="mt-3 text-sm font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/buyer">Continue shopping</Link>
          </Button>
          {isUuid(orderId) ? (
            <Button asChild variant="secondary">
              <Link href={`/buyer/orders/${orderId}`}>View order details</Link>
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <Link href="/profile">View account</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
