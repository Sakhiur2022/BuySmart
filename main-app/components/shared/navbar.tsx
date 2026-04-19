import Link from 'next/link';
import Image from 'next/image';
import { Suspense } from 'react';
import { AuthButton } from '@/components/shared/auth-button';
import { hasEnvVars } from '@/lib/utils';
import { EnvVarWarning } from '@/components/shared/env-var-warning';
import { createClient } from '@/lib/supabase/server';
import { PromotionalBanner } from '@/components/shared/promotional-banner';
import { MobileNavMenu } from '@/components/shared/mobile-nav-menu';
import { NavbarCenterNav } from '@/components/shared/navbar-center-nav';

type NavbarRole = 'buyer' | 'seller' | 'admin' | 'moderator' | null;

const buyerNav = [
  { href: '/buyer/dashboard', label: 'Buyer Dashboard', icon: 'bar-chart-3' },
  { href: '/buyer/orders', label: 'Orders', icon: 'clipboard-list' },
];

const adminNav = [
  { href: '/buyer', label: 'Buyer', icon: 'shopping-bag' },
  { href: '/admin', label: 'Admin Dashboard', icon: 'shield-check' },
];

const sellerNav = [
  { href: '/seller', label: 'Seller Dashboard', icon: 'store' },
  { href: '/buyer?mode=buyer', label: 'Switch to Buyer', icon: 'arrow-left-right' },
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
      <header className="w-full border-b border-rose-200/70 bg-linear-to-r from-rose-50 via-white to-rose-50 backdrop-blur supports-backdrop-filter:bg-background/60 dark:border-rose-500/30 dark:from-rose-950/40 dark:via-background/70 dark:to-rose-950/40">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-2 sm:gap-4">
            {/* Left: Mobile menu + Logo */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              {/* Mobile nav menu - always show */}
              <MobileNavMenu
                items={
                  role === 'admin' || role === 'moderator'
                    ? adminNav
                    : role === 'seller'
                      ? [...sellerNav, ...buyerNav]
                      : buyerNav
                }
                role={role}
              />

              {/* Brand - Logo */}
              <Link href="/" className="flex items-center shrink-0">
                <Image
                  src="/icons/CSE327_Logo_red.jpg"
                  alt="BuySmart Logo"
                  height={40}
                  width={160}
                  priority
                  className="object-contain h-8 w-auto md:h-10"
                />
              </Link>
            </div>

            {/* Center: Desktop Nav Links */}
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
              <NavbarCenterNav role={role} />
            </nav>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 sm:gap-3 ml-auto">
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
