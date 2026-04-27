'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldCheck, ShoppingBag } from 'lucide-react';

type NavbarRole = 'buyer' | 'seller' | 'admin' | 'moderator' | null;

type NavbarCenterNavProps = {
  role: NavbarRole;
};

export function NavbarCenterNav({ role }: NavbarCenterNavProps) {
  const pathname = usePathname();
  const isInBuyerSection = pathname.startsWith('/buyer');
  const isInAdminSection = pathname.startsWith('/admin');
  const inferredRole = (() => {
    if (pathname.startsWith('/seller')) {
      return 'seller';
    }
    if (pathname.startsWith('/admin')) {
      return 'admin';
    }
    if (pathname.startsWith('/buyer')) {
      return 'buyer';
    }
    return null;
  })();
  const resolvedRole = role ?? inferredRole;

  if (role === 'admin' || role === 'moderator') {
    return (
      <>
        {!isInBuyerSection ? (
          <Link
            href="/buyer"
            className="inline-flex items-center gap-2 rounded-full border border-pink-300/70 bg-linear-to-r from-pink-100 via-rose-100 to-amber-100 px-4 py-1.5 font-semibold text-rose-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:from-pink-200 hover:to-amber-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 dark:border-pink-500/40 dark:from-rose-900/40 dark:via-pink-900/30 dark:to-amber-900/30 dark:text-pink-100"
            title="Browse products"
          >
            <ShoppingBag className="h-4 w-4" />
            <span>Buyer</span>
          </Link>
        ) : null}
        {!isInAdminSection ? (
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 rounded-full border border-pink-300/70 bg-linear-to-r from-pink-100 via-rose-100 to-amber-100 px-4 py-1.5 font-semibold text-rose-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:from-pink-200 hover:to-amber-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 dark:border-pink-500/40 dark:from-rose-900/40 dark:via-pink-900/30 dark:to-amber-900/30 dark:text-pink-100"
            title="Open admin dashboard"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Admin Dashboard</span>
          </Link>
        ) : null}
      </>
    );
  }

  if (resolvedRole === 'seller') {
    return null;
  }

  if (isInBuyerSection) {
    return null;
  }

  return (
    <Link
      href="/buyer"
      className="inline-flex items-center gap-2 text-rose-700 transition-colors hover:text-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 dark:text-pink-100 dark:hover:text-pink-50"
      title="Browse products"
    >
      <ShoppingBag className="h-4 w-4" />
      <span>Products</span>
    </Link>
  );
}
