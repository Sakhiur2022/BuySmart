import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  SalesOverviewChart,
  type SalesOverviewPoint,
} from '@/components/seller/sales-overview-chart';
import {
  DeliveryQueue,
  type DeliveryQueueItem,
} from '@/components/seller/delivery-queue';
import { DeleteProductForm } from '@/components/seller/delete-product-form';
import { getFeedbackInsightsForUser } from '@/lib/services/insights.service';
import { createClient } from '@/lib/supabase/server';
import { formatCurrency } from '@/lib/utils';

type RecentOrderItem = {
  order_item_id: string;
  order_id: string;
  total_price: number;
  status: string;
  created_at: string;
  products?: Array<{ name: string; images?: unknown }> | null;
  users_profile?: Array<{ full_name: string | null; display_name: string | null }> | null;
  order_number?: string;
};

const STAT_DELTAS = {
  revenue: '+12.5%',
  orders: '+8.2%',
  products: '+2',
  averageOrder: '+5.1%',
};

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
const SENTIMENT_META = {
  positive: {
    label: 'Positive',
    chip: 'border-emerald-200 bg-emerald-100 text-emerald-700',
    dot: 'bg-emerald-500',
  },
  neutral: {
    label: 'Neutral',
    chip: 'border-slate-200 bg-slate-100 text-slate-700',
    dot: 'bg-slate-500',
  },
  negative: {
    label: 'Negative',
    chip: 'border-rose-200 bg-rose-100 text-rose-700',
    dot: 'bg-rose-500',
  },
  mixed: {
    label: 'Mixed',
    chip: 'border-amber-200 bg-amber-100 text-amber-700',
    dot: 'bg-amber-500',
  },
};

type SellerPageProps = {
  searchParams?: Promise<{
    deleted?: string | string[];
    error?: string | string[];
  }>;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatPercentage(value: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
  }).format(value);
}

function formatConfidence(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(value);
}

function resolveScoreLabel(score: number) {
  if (score >= 0.2) {
    return { label: 'Positive', className: 'text-emerald-600' };
  }

  if (score <= -0.2) {
    return { label: 'Negative', className: 'text-rose-600' };
  }

  return { label: 'Neutral', className: 'text-slate-600' };
}

function pickImage(images: unknown): string | null {
  if (Array.isArray(images) && typeof images[0] === 'string') {
    return images[0];
  }

  if (images && typeof images === 'object') {
    const record = images as Record<string, unknown>;
    if (typeof record.url === 'string') {
      return record.url;
    }
  }

  return null;
}

function getSearchValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function resolveCustomerName(
  profile: { full_name: string | null; display_name: string | null } | null,
) {
  return profile?.display_name || profile?.full_name || 'Customer';
}

export default async function SellerPage({ searchParams }: SellerPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const { data: profile } = await supabase
    .from('users_profile')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  const role = profile?.role ?? null;

  if (role === 'admin' || role === 'moderator') {
    return (
      <div className="space-y-6">
        <section className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">Seller Dashboard</h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Admin or moderator can&apos;t be a seller.
          </p>
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Your account role is <span className="font-semibold">{role}</span>. Seller tools are
            unavailable for admin and moderator accounts.
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/buyer">Go to Buyer</Link>
            </Button>
            <Button asChild>
              <Link href="/admin">Open Admin Dashboard</Link>
            </Button>
          </div>
        </section>
      </div>
    );
  }

  if (role && role !== 'seller') {
    redirect('/buyer');
  }

  const { data: productsData } = await supabase
    .from('products')
    .select('product_id, name, price, inventory_quantity, status, images, created_at, category_id')
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false });

  const { data: orderItemsData } = await supabase
    .from('order_items')
    .select('order_id, product_id, total_price, quantity, created_at')
    .eq('seller_id', user.id);

  const { data: recentOrderItemsData } = await supabase
    .from('order_items')
    .select(
      'order_item_id, order_id, total_price, status, created_at, products(name, images), orders(order_number, created_at, users_profile(full_name, display_name))',
    )
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false })
    .limit(6);

  const { data: deliveryQueueData } = await supabase
    .from('order_items')
    .select(
      'order_item_id, order_id, status, created_at, products(name), orders(order_number, users_profile(full_name, display_name))',
    )
    .eq('seller_id', user.id)
    .in('status', ['pending', 'confirmed', 'shipped'])
    .order('created_at', { ascending: false })
    .limit(8);

  let feedbackInsights = null;
  let feedbackInsightsError: string | null = null;

  try {
    feedbackInsights = await getFeedbackInsightsForUser(user.id, {
      timeframe: '30d',
      sellerId: user.id,
    });
  } catch (error) {
    if (error instanceof Error) {
      feedbackInsightsError = error.message;
    } else {
      feedbackInsightsError = 'Unable to load feedback insights.';
    }
  }

  const products = productsData ?? [];
  const orderItems = orderItemsData ?? [];
  const recentOrders = recentOrderItemsData ?? [];
  const deliveryQueueItems: DeliveryQueueItem[] = (deliveryQueueData ?? []).map((item) => {
    const productName = item.products?.[0]?.name ?? 'Product';
    const orderMeta = (item as { orders?: { order_number?: string; users_profile?: unknown } })
      .orders;
    const profile =
      (orderMeta?.users_profile as Array<{ full_name: string | null; display_name: string | null }> | undefined)?.[0] ??
      (item as { users_profile?: Array<{ full_name: string | null; display_name: string | null }> })
        .users_profile?.[0] ??
      null;
    const orderNumber = orderMeta?.order_number ?? item.order_number ?? item.order_id;

    return {
      orderItemId: item.order_item_id,
      orderId: item.order_id,
      orderNumber,
      productName,
      customerName: resolveCustomerName(profile),
      status: String(item.status ?? 'processing'),
      createdAt: item.created_at,
    };
  });

  const resolvedSearchParams = await searchParams;
  const deleted = getSearchValue(resolvedSearchParams?.deleted);
  const error = getSearchValue(resolvedSearchParams?.error);

  const totalRevenue = orderItems.reduce((sum, item) => sum + (item.total_price ?? 0), 0);
  const totalOrders = new Set(orderItems.map((item) => item.order_id)).size;
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const productsListed = products.length;
  const scoreLabel = feedbackInsights
    ? resolveScoreLabel(feedbackInsights.averageSentimentScore)
    : null;

  const soldByProduct = new Map<string, number>();
  orderItems.forEach((item) => {
    if (!item.product_id) {
      return;
    }
    const current = soldByProduct.get(item.product_id) ?? 0;
    soldByProduct.set(item.product_id, current + (item.quantity ?? 0));
  });

  const now = new Date();
  const year = now.getFullYear();
  const rangeStart = new Date(year, 0, 1);
  const rangeEnd = new Date(year, 6, 0, 23, 59, 59, 999);

  const salesOverview: SalesOverviewPoint[] = MONTH_LABELS.map((label) => ({
    month: label,
    total: 0,
  }));

  orderItems.forEach((item) => {
    const date = new Date(item.created_at);
    if (date < rangeStart || date > rangeEnd) {
      return;
    }
    const monthIndex = date.getMonth();
    if (monthIndex >= 0 && monthIndex < 6) {
      salesOverview[monthIndex].total += item.total_price ?? 0;
    }
  });

  const hasSalesData = salesOverview.some((point) => point.total > 0);

  return (
    <div className="space-y-8">
      <section className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">Seller Dashboard</h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Manage your products and track your sales
            </p>
          </div>
          <Button asChild className="shrink-0">
            <Link href="/seller/products/new">Add Product</Link>
          </Button>
        </div>
      </section>

      {deleted ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Product deleted successfully.
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-semibold">{formatCurrency(totalRevenue)}</p>
            <p className="text-xs text-emerald-600">{STAT_DELTAS.revenue}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Total Orders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-semibold">{formatNumber(totalOrders)}</p>
            <p className="text-xs text-emerald-600">{STAT_DELTAS.orders}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Products Listed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-semibold">{formatNumber(productsListed)}</p>
            <p className="text-xs text-emerald-600">{STAT_DELTAS.products}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Avg Order Value</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-semibold">{formatCurrency(averageOrderValue)}</p>
            <p className="text-xs text-emerald-600">{STAT_DELTAS.averageOrder}</p>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Sales Overview</CardTitle>
          </CardHeader>
          <CardContent>
            {hasSalesData ? (
              <SalesOverviewChart data={salesOverview} />
            ) : (
              <div className="flex h-72 items-center justify-center rounded-xl border border-dashed bg-muted/30 text-sm text-muted-foreground">
                No sales data yet for this period.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card>
          <CardHeader className="border-b">
            <div className="space-y-1">
              <CardTitle>Sentiment Summary</CardTitle>
              <CardDescription>Last 30 days of feedback sentiment.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {feedbackInsightsError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {feedbackInsightsError}
              </div>
            ) : feedbackInsights ? (
              <Tabs defaultValue="overall" className="space-y-4">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="overall">Overall</TabsTrigger>
                  <TabsTrigger value="products">Per product</TabsTrigger>
                </TabsList>
                <TabsContent value="overall" className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-lg border bg-muted/20 px-4 py-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Feedback Volume
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {formatNumber(feedbackInsights.totalFeedbackCount)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Classified: {formatNumber(feedbackInsights.sentimentBreakdown.totalClassified)}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-muted/20 px-4 py-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Avg Sentiment Score
                      </p>
                      <div className="mt-2 flex items-baseline gap-3">
                        <p className="text-2xl font-semibold">
                          {feedbackInsights.averageSentimentScore.toFixed(2)}
                        </p>
                        {scoreLabel ? (
                          <span className={`text-xs font-semibold ${scoreLabel.className}`}>
                            {scoreLabel.label}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">Scale -1 to 1</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {(['positive', 'neutral', 'negative', 'mixed'] as const).map((sentiment) => {
                      const metric = feedbackInsights.sentimentBreakdown[sentiment];
                      const meta = SENTIMENT_META[sentiment];
                      const percentage = Math.min(100, Math.max(0, metric.percentage));

                      return (
                        <div key={sentiment} className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                              <span className="font-medium text-foreground">{meta.label}</span>
                            </div>
                            <span className="text-muted-foreground">
                              {formatNumber(metric.count)} ({formatPercentage(percentage)}%)
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-muted">
                            <div
                              className={`h-2 rounded-full ${meta.dot}`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>
                <TabsContent value="products" className="space-y-4">
                  {feedbackInsights.perProductSummaries.length === 0 ? (
                    <div className="rounded-xl border border-dashed bg-muted/30 px-6 py-10 text-center text-sm text-muted-foreground">
                      No product feedback yet. Per-product breakdown will appear here.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                            <th className="px-3 py-2">Product</th>
                            <th className="px-3 py-2">Positive</th>
                            <th className="px-3 py-2">Neutral</th>
                            <th className="px-3 py-2">Negative</th>
                            <th className="px-3 py-2">Mixed</th>
                            <th className="px-3 py-2">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {feedbackInsights.perProductSummaries.map((summary) => (
                            <tr key={summary.productId} className="border-b last:border-b-0">
                              <td className="px-3 py-3 font-medium text-foreground">
                                {summary.productName}
                              </td>
                              <td className="px-3 py-3 text-muted-foreground">
                                {formatNumber(summary.sentimentBreakdown.positive.count)} (
                                {formatPercentage(summary.sentimentBreakdown.positive.percentage)}%)
                              </td>
                              <td className="px-3 py-3 text-muted-foreground">
                                {formatNumber(summary.sentimentBreakdown.neutral.count)} (
                                {formatPercentage(summary.sentimentBreakdown.neutral.percentage)}%)
                              </td>
                              <td className="px-3 py-3 text-muted-foreground">
                                {formatNumber(summary.sentimentBreakdown.negative.count)} (
                                {formatPercentage(summary.sentimentBreakdown.negative.percentage)}%)
                              </td>
                              <td className="px-3 py-3 text-muted-foreground">
                                {formatNumber(summary.sentimentBreakdown.mixed.count)} (
                                {formatPercentage(summary.sentimentBreakdown.mixed.percentage)}%)
                              </td>
                              <td className="px-3 py-3 text-foreground">
                                {formatNumber(summary.totalClassified)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            ) : (
              <div className="rounded-xl border border-dashed bg-muted/30 px-6 py-10 text-center text-sm text-muted-foreground">
                No feedback insights yet. Check back once customers leave reviews.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <div className="space-y-1">
              <CardTitle>Top Feedback</CardTitle>
              <CardDescription>Highlights with strongest sentiment signals.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {feedbackInsights ? (
              <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">Positive</p>
                    <Badge className={SENTIMENT_META.positive.chip}>Top signals</Badge>
                  </div>
                  {feedbackInsights.highlights.positive.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No positive highlights yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {feedbackInsights.highlights.positive.map((highlight) => (
                        <div key={highlight.feedbackId} className="rounded-lg border px-4 py-3">
                          <p className="text-sm text-foreground line-clamp-3">{highlight.snippet}</p>
                          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                            <span>{new Date(highlight.createdAt).toLocaleDateString('en-US')}</span>
                            <span>Confidence {formatConfidence(highlight.confidenceScore)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">Negative</p>
                    <Badge className={SENTIMENT_META.negative.chip}>Needs attention</Badge>
                  </div>
                  {feedbackInsights.highlights.negative.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No negative highlights yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {feedbackInsights.highlights.negative.map((highlight) => (
                        <div key={highlight.feedbackId} className="rounded-lg border px-4 py-3">
                          <p className="text-sm text-foreground line-clamp-3">{highlight.snippet}</p>
                          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                            <span>{new Date(highlight.createdAt).toLocaleDateString('en-US')}</span>
                            <span>Confidence {formatConfidence(highlight.confidenceScore)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-dashed bg-muted/30 px-6 py-10 text-center text-sm text-muted-foreground">
                Top feedback will appear once sentiment analysis completes.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Your Products</CardTitle>
          </CardHeader>
          <CardContent>
            {products.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-muted/30 px-6 py-10 text-center text-sm text-muted-foreground">
                No products listed yet. Add your first product to start selling.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2">Product</th>
                      <th className="px-3 py-2">Price</th>
                      <th className="px-3 py-2">Stock</th>
                      <th className="px-3 py-2">Sold</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => {
                      const imageUrl = pickImage(product.images);
                      const soldCount = soldByProduct.get(product.product_id) ?? 0;

                      return (
                        <tr key={product.product_id} className="border-b last:border-b-0">
                          <td className="px-3 py-4">
                            <div className="flex items-center gap-3">
                              {imageUrl ? (
                                <Image
                                  src={imageUrl}
                                  alt={product.name}
                                  width={40}
                                  height={40}
                                  className="rounded-md object-cover"
                                />
                              ) : (
                                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                                  N/A
                                </div>
                              )}
                              <div className="font-medium text-foreground">{product.name}</div>
                            </div>
                          </td>
                          <td className="px-3 py-4">{formatCurrency(product.price)}</td>
                          <td className="px-3 py-4">{formatNumber(product.inventory_quantity)}</td>
                          <td className="px-3 py-4">{formatNumber(soldCount)}</td>
                          <td className="px-3 py-4">
                            <Badge className="border-emerald-200 bg-emerald-100 text-emerald-700">
                              {String(product.status ?? 'active')}
                            </Badge>
                          </td>
                          <td className="px-3 py-4">
                            <div className="flex justify-end gap-2">
                              <Button asChild size="xs" variant="outline">
                                <Link href={`/seller/products/${product.product_id}/edit`}>
                                  Edit
                                </Link>
                              </Button>
                              <DeleteProductForm
                                productId={product.product_id}
                                productName={product.name}
                                returnTo="/seller"
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Delivery Confirmation</CardTitle>
          </CardHeader>
          <CardContent>
            <DeliveryQueue items={deliveryQueueItems} />
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-muted/30 px-6 py-10 text-center text-sm text-muted-foreground">
                No recent orders yet. New orders will show up here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2">Order ID</th>
                      <th className="px-3 py-2">Customer</th>
                      <th className="px-3 py-2">Product</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((order: RecentOrderItem) => {
                      const profile = order.users_profile?.[0] ?? null;
                      const orderNumber = order.order_number ?? order.order_id;
                      const createdAt = order.created_at;

                      return (
                        <tr key={order.order_item_id} className="border-b last:border-b-0">
                          <td className="px-3 py-4 font-medium text-foreground">{orderNumber}</td>
                          <td className="px-3 py-4">{resolveCustomerName(profile)}</td>
                          <td className="px-3 py-4">{order.products?.[0]?.name ?? 'Product'}</td>
                          <td className="px-3 py-4">{formatCurrency(order.total_price)}</td>
                          <td className="px-3 py-4">
                            <Badge className="border-amber-200 bg-amber-100 text-amber-700">
                              {String(order.status ?? 'processing')}
                            </Badge>
                          </td>
                          <td className="px-3 py-4">
                            {createdAt ? new Date(createdAt).toLocaleDateString('en-US') : 'N/A'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
