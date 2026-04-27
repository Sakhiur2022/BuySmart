'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ArrowLeftRight, BarChart3, ClipboardList, Store } from 'lucide-react';
import { CartNavButton } from '@/components/shared/cart-nav-button';

type NavbarRole = 'buyer' | 'seller' | 'admin' | 'moderator' | null;

type NavbarRoleActionsProps = {
  role: NavbarRole;
};

export function NavbarRoleActions({ role }: NavbarRoleActionsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const buyerModeParam = searchParams?.get('mode');
  const isBuyerMode = buyerModeParam === 'buyer' || buyerModeParam === '1' || buyerModeParam === 'true';
  const isBuyerRoute = pathname.startsWith('/buyer');
  const isBuyerDashboardRoute = pathname.startsWith('/buyer/dashboard');
  const isBuyerOrdersRoute = pathname.startsWith('/buyer/orders');
  const isBuyerCartRoute = pathname.startsWith('/buyer/cart');
  const isSellerRoute = pathname.startsWith('/seller');
  const isBuyerContext = isBuyerRoute || isBuyerMode;

  const showBuyerActions = role === 'buyer' || (role === 'seller' && isBuyerContext);
  const showSellerActions = role === 'seller' && !isBuyerContext;
  const showSellerDashboardLink = showSellerActions && !isSellerRoute;
  const showSwitchToBuyerLink = showSellerActions && !isBuyerRoute;

  if (role !== 'seller' && !showBuyerActions) {
    return null;
  }

  return (
    <div className="flex items-center gap-3">
      {showSellerActions ? (
        <>
          {showSellerDashboardLink ? (
            <Link
              href="/seller"
              className="inline-flex items-center text-rose-700 transition-colors hover:text-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 dark:text-pink-100 dark:hover:text-pink-50"
              title="Open seller dashboard"
              aria-label="Open seller dashboard"
            >
              <Store className="h-4 w-4" />
            </Link>
          ) : null}
          {showSwitchToBuyerLink ? (
            <Link
              href="/buyer?mode=buyer"
              className="inline-flex items-center text-rose-700 transition-colors hover:text-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 dark:text-pink-100 dark:hover:text-pink-50"
              title="Switch to buyer mode"
              aria-label="Switch to buyer mode"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </Link>
          ) : null}
        </>
      ) : null}

      {showBuyerActions ? (
        <>
          {!isBuyerCartRoute ? <CartNavButton /> : null}
          {!isBuyerDashboardRoute ? (
            <Link
              href="/buyer/dashboard"
              className="inline-flex items-center text-rose-700 transition-colors hover:text-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 dark:text-pink-100 dark:hover:text-pink-50"
              title="Open buyer dashboard"
              aria-label="Open buyer dashboard"
            >
              <BarChart3 className="h-4 w-4" />
            </Link>
          ) : null}
          {!isBuyerOrdersRoute ? (
            <Link
              href="/buyer/orders"
              className="inline-flex items-center text-rose-700 transition-colors hover:text-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 dark:text-pink-100 dark:hover:text-pink-50"
              title="View orders"
              aria-label="View orders"
            >
              <ClipboardList className="h-4 w-4" />
            </Link>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
