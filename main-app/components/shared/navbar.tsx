import Link from 'next/link';
import Image from 'next/image';
import { Suspense } from 'react';
import { ThemeSwitcher } from '@/components/shared/theme-switcher';
import { AuthButton } from '@/components/shared/auth-button';
import { hasEnvVars } from '@/lib/utils';
import { EnvVarWarning } from '@/components/shared/env-var-warning';
import { createClient } from '@/lib/supabase/server';
import { SellerNavLink } from '@/components/shared/seller-nav-link';
import { PromotionalBanner } from '@/components/shared/promotional-banner';
import { CartNavButton } from '@/components/shared/cart-nav-button';
import { BuyerHubMenu } from '@/components/shared/buyer-hub-menu';

type NavbarRole = 'buyer' | 'seller' | 'admin' | 'moderator' | null;

const buyerNav = [
  { href: '/buyer/dashboard', label: 'Buyer Dashboard' },
  { href: '/buyer/orders', label: 'Orders' },
  { href: '/buyer/cart', label: 'Cart' },
];

export async function Navbar() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;

  let role: NavbarRole = null;
  if (user) {
    const { data: profile } = await supabase
      .from('users_profile')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();
    role = (profile?.role as NavbarRole) ?? null;
  }

  return (
    <div className="sticky top-0 z-40">
      <PromotionalBanner visiblePaths={['/', '/buyer']} />
      <header className="w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex items-center gap-3 shrink-0">
              <BuyerHubMenu items={buyerNav} />

              {/* Brand - Logo */}
              <Link href="/" className="flex items-center gap-2 shrink-0">
                <Image
                  src="/icons/CSE327_Logo_red.jpg"
                  alt="BuySmart Logo"
                  height={40}
                  width={140}
                  priority
                  className="object-contain h-8 w-auto md:h-10"
                />
              </Link>
            </div>

            {/* Main Nav */}
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
              {role === 'admin' || role === 'moderator' ? (
                <>
                  <Link
                    href="/buyer"
                    className="rounded-full border border-pink-300/70 bg-linear-to-r from-pink-100 via-rose-100 to-amber-100 px-4 py-1.5 font-semibold text-rose-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:from-pink-200 hover:to-amber-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 dark:border-pink-500/40 dark:from-rose-900/40 dark:via-pink-900/30 dark:to-amber-900/30 dark:text-pink-100"
                    title="Browse products"
                  >
                    Buyer
                  </Link>
                  <Link
                    href="/admin"
                    className="rounded-full border border-pink-300/70 bg-linear-to-r from-pink-100 via-rose-100 to-amber-100 px-4 py-1.5 font-semibold text-rose-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:from-pink-200 hover:to-amber-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 dark:border-pink-500/40 dark:from-rose-900/40 dark:via-pink-900/30 dark:to-amber-900/30 dark:text-pink-100"
                    title="Open admin dashboard"
                  >
                    Admin Dashboard
                  </Link>
                </>
              ) : (
                <SellerNavLink role={role} />
              )}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-3">
              <CartNavButton />
              <ThemeSwitcher />
              {!hasEnvVars ? (
                <EnvVarWarning />
              ) : (
                <Suspense fallback={null}>
                  <AuthButton />
                </Suspense>
              )}
            </div>
          </div>

        </div>
      </header>
    </div>
  );
}
