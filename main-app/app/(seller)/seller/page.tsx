import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  SalesOverviewChart,
  type SalesOverviewPoint,
} from '@/components/seller/sales-overview-chart';
import { DeleteProductForm } from '@/components/seller/delete-product-form';
import { createClient } from '@/lib/supabase/server';

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

type SellerPageProps = {
  searchParams?: Promise<{
    deleted?: string | string[];
    error?: string | string[];
  }>;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
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

  const products = productsData ?? [];
  const orderItems = orderItemsData ?? [];
  const recentOrders = recentOrderItemsData ?? [];

  const resolvedSearchParams = await searchParams;
  const deleted = getSearchValue(resolvedSearchParams?.deleted);
  const error = getSearchValue(resolvedSearchParams?.error);

  const totalRevenue = orderItems.reduce((sum, item) => sum + (item.total_price ?? 0), 0);
  const totalOrders = new Set(orderItems.map((item) => item.order_id)).size;
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const productsListed = products.length;

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
