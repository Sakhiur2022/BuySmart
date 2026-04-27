'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { SellerUpgradeCta } from '@/components/shared/seller-upgrade-cta';
import { ThemeSwitcher } from '@/components/shared/theme-switcher';
import type { ProductCandidate } from '@/lib/agents/recommendation/types';
import { hasEnvVars } from '@/lib/utils';

const TOP_CATEGORIES = ['Electronics', 'Fashion', 'Home & Living', 'Kitchen', 'Footwear'];

type HomeProduct = ProductCandidate & {
  created_at?: string;
  sales_count: number;
  average_rating: number;
};

const RAIL_ITEM_COUNT = 6;

function getCreatedAtTimestamp(date?: string) {
  if (!date) return 0;
  const timestamp = new Date(date).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function withNewestFallback(primary: HomeProduct[], fallback: HomeProduct[]) {
  if (primary.length >= RAIL_ITEM_COUNT) {
    return primary.slice(0, RAIL_ITEM_COUNT);
  }

  const seenIds = new Set(primary.map((item) => item.id));
  const merged = [...primary];
  for (const item of fallback) {
    if (seenIds.has(item.id)) continue;
    merged.push(item);
    if (merged.length >= RAIL_ITEM_COUNT) break;
  }

  return merged;
}

type HomeProductsApiResponse = {
  products: HomeProduct[];
};

type PublicProductsApiResponse = {
  products: Array<{
    product_id: string;
    name: string;
    price: number;
    image?: string;
    short_description?: string | null;
  }>;
};

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
    currency: 'BDT',
  });

  useEffect(() => {
    if (!hasEnvVars) return;
    let isMounted = true;

    const hydrateHome = async () => {
      try {
        const profileResponse = await fetch('/api/auth/me', { cache: 'no-store' });
        if (!isMounted) return;
        if (profileResponse.ok) {
          const contentType = profileResponse.headers.get('content-type') ?? '';
          if (contentType.includes('application/json')) {
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
        } else {
          setUserId(null);
          setUserRole(null);
          setIsAuthenticated(false);
          setShouldShowSellerCTA(true);
        }
      } catch {
        setUserId(null);
        setUserRole(null);
        setIsAuthenticated(false);
        setShouldShowSellerCTA(true);
      }

      let mapped: HomeProduct[] = [];

      try {
        const homeProductsResponse = await fetch('/api/products/home', { cache: 'no-store' });
        if (!homeProductsResponse.ok) {
          throw new Error(`Home products API failed with status ${homeProductsResponse.status}`);
        }

        const homeProductsPayload =
          (await homeProductsResponse.json()) as HomeProductsApiResponse;
        mapped = Array.isArray(homeProductsPayload.products) ? homeProductsPayload.products : [];
      } catch (error) {
        console.error('Failed to load active products for home page rails:', error);
      }

      if (mapped.length === 0) {
        try {
          const publicProductsResponse = await fetch('/api/products?page=1&pageSize=18', {
            cache: 'no-store',
          });

          if (!publicProductsResponse.ok) {
            throw new Error(
              `Public products API failed with status ${publicProductsResponse.status}`,
            );
          }

          const publicProductsPayload =
            (await publicProductsResponse.json()) as PublicProductsApiResponse;

          mapped = Array.isArray(publicProductsPayload.products)
            ? publicProductsPayload.products.map((product) => ({
                id: product.product_id,
                title: product.name,
                price: product.price ?? 0,
                image: product.image,
                sales_count: 0,
                average_rating: 0,
              }))
            : [];
        } catch (error) {
          console.error('Failed to load public fallback products for home page rails:', error);
        }
      }

      if (isMounted) {
        if (mapped.length === 0) {
          setBestSellerProducts([]);
          setTrendingProducts([]);
          setLatestProducts([]);
          setProductRatings({});
          return;
        }

        const newestProducts = [...mapped].sort(
          (a, b) => getCreatedAtTimestamp(b.created_at) - getCreatedAtTimestamp(a.created_at),
        );

        const now = Date.now();
        const bestSellerRanked = [...mapped].sort((a, b) => {
          if (b.sales_count !== a.sales_count) return b.sales_count - a.sales_count;
          return getCreatedAtTimestamp(b.created_at) - getCreatedAtTimestamp(a.created_at);
        });

        const trendingRanked = [...mapped].sort((a, b) => {
          const aAgeDays = Math.max(
            0,
            (now - getCreatedAtTimestamp(a.created_at)) / (1000 * 60 * 60 * 24),
          );
          const bAgeDays = Math.max(
            0,
            (now - getCreatedAtTimestamp(b.created_at)) / (1000 * 60 * 60 * 24),
          );
          const aRecencyBoost = Math.max(0, 10 - aAgeDays / 3);
          const bRecencyBoost = Math.max(0, 10 - bAgeDays / 3);
          const aScore = a.sales_count * 4 + a.average_rating * 12 + aRecencyBoost;
          const bScore = b.sales_count * 4 + b.average_rating * 12 + bRecencyBoost;
          if (bScore !== aScore) return bScore - aScore;
          return getCreatedAtTimestamp(b.created_at) - getCreatedAtTimestamp(a.created_at);
        });

        const latestSelection = newestProducts.slice(0, RAIL_ITEM_COUNT);
        const hasSalesSignal = bestSellerRanked.some((product) => product.sales_count > 0);
        const hasTrendingSignal = trendingRanked.some(
          (product) => product.sales_count > 0 || product.average_rating > 0,
        );

        const bestSellerSelection = hasSalesSignal
          ? withNewestFallback(bestSellerRanked, newestProducts)
          : latestSelection;
        const trendingSelection = hasTrendingSignal
          ? withNewestFallback(trendingRanked, newestProducts)
          : latestSelection;

        setBestSellerProducts(bestSellerSelection);
        setTrendingProducts(trendingSelection);
        setLatestProducts(latestSelection);

        const ratings: Record<string, number> = {};
        mapped.forEach((p) => {
          ratings[p.id] = p.average_rating ?? 0;
        });
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
          <div className="relative z-10 flex flex-1 flex-col gap-6">
            <div className="flex flex-wrap gap-3">
              {TOP_CATEGORIES.map((category) => (
                <Link
                  key={category}
                  href={`/buyer/products?category=${encodeURIComponent(category)}`}
                  className="rounded-full border border-white/30 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-foreground transition hover:border-primary hover:text-primary"
                >
                  {category}
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
                href="/buyer"
                className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary"
              >
                Browse all products
              </Link>
            </div>
            {shouldShowSellerCTA ? (
              <div className="relative z-10 rounded-2xl border border-white/20 bg-white/70 p-4 text-sm text-muted-foreground">
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
          <div className="relative z-0 flex flex-1 flex-col gap-6">
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
                  <div className="absolute inset-0 bg-linear-to-t from-black/50 via-black/5 to-transparent" />
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
                  href="/buyer"
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
                      <Link
                        href={productHref}
                        className="relative block h-52 overflow-hidden bg-neutral-100"
                      >
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
