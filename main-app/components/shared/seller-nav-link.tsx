'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type SellerNavLinkProps = {
  role: 'buyer' | 'seller' | null;
};

export function SellerNavLink({ role }: SellerNavLinkProps) {
  const pathname = usePathname();

  if (pathname.startsWith('/auth')) {
    return null;
  }

  if (role === 'seller') {
    if (pathname.startsWith('/seller')) {
      return null;
    }

    return (
      <Link
        href="/seller"
        className="rounded-full border border-pink-300/70 bg-linear-to-r from-pink-100 via-rose-100 to-amber-100 px-4 py-1.5 font-semibold text-rose-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:from-pink-200 hover:to-amber-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 dark:border-pink-500/40 dark:from-rose-900/40 dark:via-pink-900/30 dark:to-amber-900/30 dark:text-pink-100"
        title="Open seller dashboard"
      >
        Seller Dashboard
      </Link>
    );
  }

  return (
    <Link
      href="/buyer"
      className="rounded-full border border-pink-300/70 bg-linear-to-r from-pink-100 via-rose-100 to-amber-100 px-4 py-1.5 font-semibold text-rose-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:from-pink-200 hover:to-amber-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 dark:border-pink-500/40 dark:from-rose-900/40 dark:via-pink-900/30 dark:to-amber-900/30 dark:text-pink-100"
      title="Browse products"
    >
      Products
    </Link>
  );
}
