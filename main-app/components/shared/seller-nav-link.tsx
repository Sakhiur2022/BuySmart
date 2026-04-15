'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type SellerNavLinkProps = {
  role: 'buyer' | 'seller' | null;
};

export function SellerNavLink({ role }: SellerNavLinkProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [resolvedRole, setResolvedRole] = useState<'buyer' | 'seller' | null>(role);

  useEffect(() => {
    if (role) {
      return;
    }

    let isMounted = true;
    const resolveRole = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!isMounted) {
        return;
      }

      if (!user) {
        setResolvedRole(null);
        return;
      }

      const { data: profile } = await supabase
        .from('users_profile')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!isMounted) {
        return;
      }

      setResolvedRole((profile?.role as 'buyer' | 'seller' | null) ?? null);
    };

    resolveRole();

    return () => {
      isMounted = false;
    };
  }, [role]);

  if (pathname.startsWith('/auth')) {
    return null;
  }

  const activeRole = role ?? resolvedRole;
  const buyerModeParam = searchParams?.get('mode');
  const isBuyerMode = buyerModeParam === 'buyer' || buyerModeParam === '1' || buyerModeParam === 'true';
  const isBuyerContext = pathname.startsWith('/buyer') || isBuyerMode;

  if (activeRole === 'seller') {
    const onSellerRoute = pathname.startsWith('/seller');

    return (
      <>
        {!onSellerRoute ? (
          <Link
            href="/seller"
            className="rounded-full border border-pink-300/70 bg-linear-to-r from-pink-100 via-rose-100 to-amber-100 px-4 py-1.5 font-semibold text-rose-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:from-pink-200 hover:to-amber-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 dark:border-pink-500/40 dark:from-rose-900/40 dark:via-pink-900/30 dark:to-amber-900/30 dark:text-pink-100"
            title="Open seller dashboard"
          >
            Seller Dashboard
          </Link>
        ) : null}
        {!isBuyerContext ? (
          <Link
            href="/buyer?mode=buyer"
            className="rounded-full border border-pink-300/70 bg-linear-to-r from-pink-100 via-rose-100 to-amber-100 px-4 py-1.5 font-semibold text-rose-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:from-pink-200 hover:to-amber-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 dark:border-pink-500/40 dark:from-rose-900/40 dark:via-pink-900/30 dark:to-amber-900/30 dark:text-pink-100"
            title="Switch to buyer mode"
          >
            Switch to Buyer
          </Link>
        ) : null}
      </>
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
