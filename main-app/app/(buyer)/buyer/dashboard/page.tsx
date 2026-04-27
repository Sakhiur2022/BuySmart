import Link from 'next/link';
import { redirect } from 'next/navigation';
import BuyerRefundStatusList from '@/components/orders/buyer-refund-status-list';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getBuyerOrderDashboardStats } from '@/lib/services/order.service';
import { listBuyerRefundsForUser } from '@/lib/services/refund.service';
import { createClient } from '@/lib/supabase/server';
import { getServiceRoleSupabase } from '@/lib/supabase/service-role';
import type { RefundSummaryDTO } from '@/lib/types/refund.types';

type RecentViewItem = {
  productId: string;
  productName: string;
  viewedAt: string;
};

function formatRelativeTime(value: string): string {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return 'Recently';
  }

  const diffMs = Date.now() - timestamp;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) {
    return 'Just now';
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getProductIdFromMetadata(value: unknown): string | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  return typeof record.product_id === 'string' ? record.product_id : null;
}

export default async function BuyerDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  let stats = { inProgressCount: 0, deliveriesThisWeek: 0 };
  let recentViews: RecentViewItem[] = [];
  let recentRefunds: RefundSummaryDTO[] = [];

  try {
    stats = await getBuyerOrderDashboardStats(user.id);
  } catch (error) {
    console.error('Failed to load buyer dashboard stats.', error);
  }

  try {
    const refundResult = await listBuyerRefundsForUser(user.id, {
      page: 1,
      pageSize: 5,
      sortBy: 'recent',
    });
    recentRefunds = refundResult.refunds;
  } catch (error) {
    console.error('Failed to load buyer refund status list.', error);
  }

  try {
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const activityClient = getServiceRoleSupabase() ?? supabase;
    const { data: activityData, error: activityError } = await activityClient
      .from('activity_logs')
      .select('log_id, entity_id, created_at, metadata')
      .eq('user_id', user.id)
      .eq('activity_type', 'product_view')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(12);

    if (activityError) {
      throw new Error(activityError.message);
    }

    const seen = new Set<string>();
    const viewRows = (activityData ?? []).filter((row) => !!row.created_at);
    const productIds = viewRows
      .map((row) =>
        typeof row.entity_id === 'string'
          ? row.entity_id
          : getProductIdFromMetadata(row.metadata),
      )
      .filter((id): id is string => Boolean(id));

    const uniqueProductIds = Array.from(new Set(productIds));
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('product_id, name')
      .in('product_id', uniqueProductIds);

    if (productsError) {
      throw new Error(productsError.message);
    }

    const productMap = new Map(
      (productsData ?? []).map((product) => [product.product_id, product.name]),
    );

    recentViews = viewRows.reduce<RecentViewItem[]>((accumulator, row) => {
      const productId =
        typeof row.entity_id === 'string' ? row.entity_id : getProductIdFromMetadata(row.metadata);

      if (!productId || seen.has(productId)) {
        return accumulator;
      }

      seen.add(productId);
      accumulator.push({
        productId,
        productName: productMap.get(productId) ?? 'Product',
        viewedAt: row.created_at,
      });

      return accumulator;
    }, []);
  } catch (error) {
    console.error('Failed to load recent views.', error);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">Buyer dashboard</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Track orders, saved items, and recent activity in one place.
          </p>
        </div>
      </section>

      <section aria-label="Buyer dashboard metrics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Orders overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>In progress</span>
              <span className="font-semibold text-foreground">{stats.inProgressCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Deliveries this week</span>
              <span className="font-semibold text-foreground">{stats.deliveriesThisWeek}</span>
            </div>
            <Button asChild size="sm" className="w-full">
              <Link href="/buyer/orders">View orders</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Saved items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Wishlist items</span>
              <span className="font-semibold text-foreground">0</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Price drops</span>
              <span className="font-semibold text-foreground">0</span>
            </div>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="w-full hover:bg-rose-50 hover:text-rose-700"
            >
              <Link href="/buyer/products">Review saved list</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent views</CardTitle>
            <p className="text-xs text-muted-foreground">Last 7 days</p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {recentViews.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                No recent views in the last 7 days.
              </div>
            ) : (
              recentViews.map((item) => (
                <Link
                  key={item.productId}
                  href={`/buyer/products/${item.productId}`}
                  className="flex items-center justify-between rounded-md px-2 py-1 transition hover:bg-muted/40"
                >
                  <span>{item.productName}</span>
                  <span className="flex items-center gap-2 text-xs">
                    {formatRelativeTime(item.viewedAt)}
                    <span className="text-muted-foreground">View -&gt;</span>
                  </span>
                </Link>
              ))
            )}
            <Button
              asChild
              size="sm"
              variant="ghost"
              className="w-full hover:bg-rose-50 hover:text-rose-700"
            >
              <Link href="/buyer/products">Keep browsing</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section aria-label="Buyer refund status list">
        <BuyerRefundStatusList refunds={recentRefunds} />
      </section>
    </div>
  );
}
