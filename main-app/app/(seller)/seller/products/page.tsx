import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
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

type ProductsPageProps = {
  searchParams?: Promise<{
    saved?: string | string[];
    updated?: string | string[];
    deleted?: string | string[];
    error?: string | string[];
  }>;
};

export default async function SellerProductsPage({ searchParams }: ProductsPageProps) {
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

  if (profile?.role !== 'seller') {
    redirect('/buyer');
  }

  const resolvedSearchParams = await searchParams;
  const { data: productsData } = await supabase
    .from('products')
    .select('product_id, name, price, inventory_quantity, status, images, created_at')
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false });

  const products = productsData ?? [];
  const saved = getSearchValue(resolvedSearchParams?.saved);
  const updated = getSearchValue(resolvedSearchParams?.updated);
  const deleted = getSearchValue(resolvedSearchParams?.deleted);
  const error = getSearchValue(resolvedSearchParams?.error);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">My Products</h1>
            <p className="text-sm text-muted-foreground">
              Add new listings, keep stock accurate, and update product details.
            </p>
          </div>
          <Button asChild className="shrink-0">
            <Link href="/seller/products/new">Add Product</Link>
          </Button>
        </div>
      </section>

      {saved ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Product created successfully.
        </div>
      ) : null}
      {updated ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Product updated successfully.
        </div>
      ) : null}
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
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const imageUrl = pickImage(product.images);

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
                        <td className="px-3 py-4">{product.inventory_quantity}</td>
                        <td className="px-3 py-4">
                          <Badge className="border-emerald-200 bg-emerald-100 text-emerald-700">
                            {String(product.status)}
                          </Badge>
                        </td>
                        <td className="px-3 py-4">
                          <div className="flex justify-end gap-2">
                            <Button asChild size="xs" variant="outline">
                              <Link href={`/seller/products/${product.product_id}/edit`}>Edit</Link>
                            </Button>
                            <form action="/seller/products/delete" method="post" className="inline-flex">
                              <input type="hidden" name="product_id" value={product.product_id} />
                              <input type="hidden" name="return_to" value="/seller/products" />
                              <Button type="submit" size="xs" variant="destructive">
                                Delete
                              </Button>
                            </form>
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
    </div>
  );
}
