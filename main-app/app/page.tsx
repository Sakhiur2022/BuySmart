'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { SellerUpgradeCta } from '@/components/shared/seller-upgrade-cta';
import { ThemeSwitcher } from '@/components/shared/theme-switcher';
import type { ProductCandidate } from '@/lib/agents/recommendation/types';
import { createClient } from '@/lib/supabase/client';
import { hasEnvVars } from '@/lib/utils';

const TOP_CATEGORIES = [
  { label: 'Electronics', href: '/products' },
  { label: 'Home', href: '/products' },
  { label: 'Style', href: '/products' },
  { label: 'Outdoor', href: '/products' },
  { label: 'Beauty', href: '/products' },
  { label: 'Gifts', href: '/products' },
];

function getFirstImageUrl(images: unknown): string | undefined {
  if (!Array.isArray(images) || images.length === 0) {
    return undefined;
  }

  const first = images[0] as unknown;

  if (typeof first === 'string' && first.trim().length > 0) {
    return first;
  }

  if (first && typeof first === 'object') {
    const record = first as Record<string, unknown>;
    const url =
      (typeof record.url === 'string' && record.url) ||
      (typeof record.src === 'string' && record.src) ||
      (typeof record.path === 'string' && record.path) ||
      undefined;

    return url && url.trim().length > 0 ? url : undefined;
  }

  return undefined;
}



export default function Home() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  // Removed candidates state as it is unused
  const [bestSellerProducts, setBestSellerProducts] = useState<ProductCandidate[]>([]);
  const [trendingProducts, setTrendingProducts] = useState<ProductCandidate[]>([]);
  const [latestProducts, setLatestProducts] = useState<ProductCandidate[]>([]);
  const [productRatings, setProductRatings] = useState<Record<string, number>>({});
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [shouldShowSellerCTA, setShouldShowSellerCTA] = useState(false);

  // Use up to 3 latest products with images for the hero slideshow
  const heroSlides = latestProducts
    .filter((p) => p.image)
    .slice(0, 3)
    .map((p) => ({
      id: p.id,
      title: p.title,
      image: p.image,
    }));

  // Dummy price formatter
  const priceFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  });

  useEffect(() => {
    if (!hasEnvVars) return;
    const supabase = createClient();
    let isMounted = true;

    const hydrateHome = async () => {
      const profileResponse = await fetch('/api/auth/me', { cache: 'no-store' });
      if (!isMounted) return;
      if (profileResponse.ok) {
        const profile = (await profileResponse.json()) as { userId: string; role: string | null };
        setUserId(profile.userId);
        setUserRole(profile.role ?? null);
        setIsAuthenticated(true);
        setShouldShowSellerCTA(!profile.role || profile.role !== 'seller');
      } else {
        setUserId(null);
        setUserRole(null);
        setIsAuthenticated(false);
        setShouldShowSellerCTA(true);
      }

      // Fetch products with sales_count and average_rating
      const { data: products } = await supabase
        .from('products')
        .select('product_id, name, category_id, price, tags, images, created_at, sales_count, average_rating')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(100);

      if (isMounted) {
        const mapped = (products ?? []).map((product) => ({
          id: product.product_id,
          title: product.name,
          category_id: product.category_id ?? undefined,
          price: product.price,
          image: getFirstImageUrl(product.images),
          tags: product.tags ?? undefined,
          created_at: product.created_at,
          sales_count: product.sales_count ?? 0,
          average_rating: product.average_rating ?? 0,
        }));
        // setCandidates(mapped); // Removed unused state update
        // Best sellers: sort by sales_count descending
        const sortedBySales = [...mapped].sort((a, b) => b.sales_count - a.sales_count);
        setBestSellerProducts(sortedBySales.slice(0, 6));
        setTrendingProducts(mapped.slice(6, 12));
        // Sort by created_at descending for new arrivals
        const sortedByCreated = [...mapped].sort((a, b) => {
          if (!a.created_at || !b.created_at) return 0;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        setLatestProducts(sortedByCreated.slice(0, 6));
        // Set ratings map for quick lookup
        const ratings: Record<string, number> = {};
        mapped.forEach((p) => { ratings[p.id] = p.average_rating ?? 0; });
        setProductRatings(ratings);
      }
    };
    hydrateHome();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="min-h-screen w-full bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-2 pb-10 pt-6">
        {/* Hero Section */}
        <section className="flex flex-col gap-8 rounded-3xl border border-white/10 bg-white/80 p-6 shadow-xl shadow-primary/10 md:flex-row md:items-center md:gap-12">
          <div className="flex flex-1 flex-col gap-6">
            <div className="flex flex-wrap gap-3">
              {TOP_CATEGORIES.map((category) => (
                <Link
                  key={category.label}
                  href={category.href}
                  className="rounded-full border border-white/30 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-foreground transition hover:border-primary hover:text-primary"
                >
                  {category.label}
                </Link>
              ))}
            </div>
            <div className="flex flex-wrap gap-4">
              <Link
                href="#new-arrivals"
                className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition hover:translate-y-0.5"
              >
                Shop new arrivals
              </Link>
              <Link
                href="/products"
                className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary"
              >
                Browse all products
              </Link>
            </div>
            {shouldShowSellerCTA ? (
              <div className="rounded-2xl border border-white/20 bg-white/70 p-4 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">Want to sell on BuySmart?</span>{' '}
                <SellerUpgradeCta
                  isAuthenticated={isAuthenticated}
                  userId={userId}
                  userRole={userRole}
                  buttonVariant="ghost"
                  buttonClassName="h-auto p-0 align-baseline font-semibold text-primary hover:bg-transparent hover:text-primary"
                >
                  Sign up as a seller
                </SellerUpgradeCta>
              </div>
            ) : null}
          </div>
          <div className="flex flex-1 flex-col gap-6">
            <div className="hero-slideshow relative h-72 overflow-hidden rounded-3xl border border-white/10 bg-background/80 shadow-xl shadow-primary/10">
              {heroSlides.map((slide, index) => (
                <div
                  key={slide.id}
                  className={`hero-slide hero-slide--${index + 1} absolute inset-0`}
                >
                  {slide.image ? (
                    <Image
                      src={slide.image}
                      alt={slide.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 50vw"
                      priority={index === 0}
                    />
                  ) : (
                    <div className="h-full w-full bg-[linear-gradient(135deg,rgba(230,57,70,0.3),rgba(255,255,255,0.7))]" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent" />
                  <div className="absolute bottom-4 left-4 rounded-full bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-foreground">
                    {slide.title}
                  </div>
                </div>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                  Best sellers
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">Top-rated essentials</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                  Trending now
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">Most wishlisted</p>
              </div>
            </div>
          </div>
        </section>
        {/* Product Rails */}
        {[
          { id: 'best-sellers', title: 'Best seller', items: bestSellerProducts },
          { id: 'trending', title: 'Trending', items: trendingProducts },
          { id: 'new-arrivals', title: 'New arrival', items: latestProducts },
        ].map((rail) => (
          <section key={rail.id} id={rail.id} className="w-full px-6 py-20">
            <div className="mx-auto flex max-w-6xl flex-col gap-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-foreground">
                    {rail.title}
                  </span>
                </div>
                <Link
                  href="/products"
                  className="rounded-full border border-white/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-foreground transition hover:border-primary hover:text-primary"
                >
                  Shop all
                </Link>
              </div>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {(rail.items.length > 0 ? rail.items : latestProducts).map((product) => {
                  const rating = productRatings[product.id] ?? 0;
                  const productHref = `/buyer/products/${product.id}`;
                  return (
                    <div
                      key={`${rail.id}-${product.id}`}
                      className="group overflow-hidden rounded-3xl border border-white/10 bg-card/80 shadow-lg shadow-primary/5"
                    >
                      <Link href={productHref} className="relative block h-52 overflow-hidden bg-neutral-100">
                        {product.image ? (
                          <Image
                            src={product.image}
                            alt={product.title}
                            fill
                            className="object-cover transition duration-500 group-hover:scale-105"
                            sizes="(max-width: 768px) 100vw, 33vw"
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-full w-full bg-[linear-gradient(135deg,rgba(230,57,70,0.25),rgba(255,255,255,0.65))]" />
                        )}
                        <div className="absolute inset-0 flex items-end justify-center bg-black/0 opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
                          <span className="mb-4 rounded-full bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-foreground">
                            Quick view
                          </span>
                        </div>
                      </Link>
                      <div className="space-y-3 p-5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                            Fresh drop
                          </span>
                          <span className="rounded-full border border-white/20 bg-white/60 px-2 py-1 text-xs font-semibold text-foreground">
                            {priceFormatter.format(product.price ?? 0)}
                          </span>
                        </div>
                        <p className="text-base font-semibold text-foreground">{product.title}</p>
                        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                          <span className="inline-flex items-center gap-1 text-foreground">
                            <svg
                              viewBox="0 0 24 24"
                              className="h-4 w-4 text-primary"
                              fill="currentColor"
                            >
                              <path d="M12 2l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17l-5.9 3.1 1.2-6.5L2.5 8.9l6.6-.9L12 2z" />
                            </svg>
                            {rating}
                          </span>
                          <span>Top rated</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        ))}
        {/* Footer */}
        <footer className="border-t border-white/10 bg-background/80 px-6 py-10">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>Built with Supabase, hardened for AI commerce.</p>
            <div className="flex items-center gap-3">
              <Link
                href="https://supabase.com/?utm_source=create-next-app&utm_medium=template&utm_term=nextjs"
                className="font-semibold text-primary hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                Supabase
              </Link>
              <ThemeSwitcher />
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
