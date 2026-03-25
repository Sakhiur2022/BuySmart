import { RecommendationPanel } from '@/components/recommendations/recommendation-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ProductCandidate } from '@/lib/agents/recommendation/types';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import ProductListingPage from '@/components/products/product-listing-page';

type BuyerPageProps = {
  searchParams?: Promise<{
    mode?: string | string[];
  }>;
};

function getSearchValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function isBuyerMode(value: string | null): boolean {
  if (!value) {
    return false;
  }

  return value === 'buyer' || value === '1' || value === 'true';
}

export default async function ProtectedPage({ searchParams }: BuyerPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const resolvedSearchParams = await searchParams;
  const buyerMode = getSearchValue(resolvedSearchParams?.mode);
  const allowSellerView = isBuyerMode(buyerMode);
  let role: string | null = null;
  let profileName: string | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from('users_profile')
      .select('role, display_name, full_name')
      .eq('user_id', user.id)
      .maybeSingle();

    role = profile?.role ?? null;
    profileName = profile?.display_name || profile?.full_name || null;

    if (role === 'seller' && !allowSellerView) {
      redirect('/seller');
    }
  }

  const isAuthenticated = Boolean(user);
  const buyerName =
    profileName ||
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    user?.email ||
    'Guest Buyer';

  const showBuyerModeBanner = role === 'seller' && allowSellerView;

  const { data: products } = await supabase
    .from('products')
    .select('product_id, name, category_id, price, tags')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(100);

  const candidates: ProductCandidate[] = (products ?? []).map((product) => ({
    id: product.product_id,
    title: product.name,
    category_id: product.category_id ?? undefined,
    price: product.price,
    tags: product.tags ?? undefined,
  }));

  // Fetch categories for product listing
  const { data: categoriesData } = await supabase
    .from('categories')
    .select('category_id, name, slug')
    .order('name', { ascending: true });

  const categories = (categoriesData ?? []).map((cat) => ({
    category_id: cat.category_id as number,
    name: cat.name as string,
    slug: cat.slug as string,
  }));

  return (
    <div className="space-y-8">
      {showBuyerModeBanner ? (
        <div className="rounded-lg border border-rose-200 bg-linear-to-r from-rose-100 via-pink-100 to-amber-100 px-4 py-3 text-sm text-rose-700 shadow-sm">
          <span className="font-semibold">Buyer mode</span> enabled. Enjoy the storefront view.{' '}
          <Link href="/seller" className="font-semibold underline underline-offset-2">
            Back to seller dashboard
          </Link>
        </div>
      ) : null}
      <section className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Badge variant="secondary" className="w-fit">
              {isAuthenticated ? 'Registered Buyer' : 'Guest Buyer'}
            </Badge>
            <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">
              Welcome, {buyerName}
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              {isAuthenticated
                ? 'Your recommendation tools are ready. Share your preferences and get AI-ranked products.'
                : 'Browse and generate AI-powered recommendations instantly. Sign in later to save preferences and unlock richer personalization.'}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {!isAuthenticated ? (
              <>
                <Button asChild variant="outline" size="sm">
                  <Link href="/auth/login">Sign in</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/auth/sign-up">Create account</Link>
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </section>

      <RecommendationPanel
        isAuthenticated={isAuthenticated}
        userEmail={user?.email ?? null}
        userDisplayName={buyerName}
        candidates={candidates}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Intent-Driven Matching</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Explain what you need in plain language and get ranked product matches.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Budget-Aware Results</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Apply budget ranges and result limits to keep recommendations practical.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Transparent Reasoning</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Every recommendation includes a short rationale and confidence score.
          </CardContent>
        </Card>
      </section>

      {!isAuthenticated ? (
        <Card className="border-primary/20 bg-secondary/30">
          <CardHeader>
            <CardTitle className="text-lg">Continue as guest, upgrade anytime</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-muted-foreground">
              Guest mode stays open for exploration. Create an account when you want to save
              activity, sync devices, and receive improved personalization.
            </p>
            <Button asChild className="w-full sm:w-auto">
              <Link href="/auth/sign-up">Unlock full buyer features</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Browse All Products</h2>
          <p className="text-zinc-600 dark:text-zinc-400">Explore our complete catalog with filtering and pagination</p>
        </div>
        <ProductListingPage
          initialProducts={[]}
          initialPagination={{
            page: 1,
            pageSize: 12,
            totalCount: 0,
            totalPages: 0,
          }}
          categories={categories}
        />
      </section>
    </div>
  );
}
