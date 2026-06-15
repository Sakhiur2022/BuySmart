import { redirect } from 'next/navigation';
import BuyerOrdersClient from '@/components/orders/buyer-orders-client';
import { createClient } from '@/lib/supabase/server';
import { getBuyerOrdersWithItemStatuses } from '@/lib/services/order.service';

const PAGE_SIZE = 10;

type BuyerOrdersPageProps = {
  searchParams?: Promise<{
    guide?: string | string[];
  }>;
};

function getSearchValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export default async function BuyerOrdersPage({ searchParams }: BuyerOrdersPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const orders = await getBuyerOrdersWithItemStatuses(user.id);

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
      <BuyerOrdersClient
        orders={orders}
        pageSize={PAGE_SIZE}
        refundGuide={getSearchValue(resolvedSearchParams?.guide) === 'refund'}
      />
    </div>
  );
}

