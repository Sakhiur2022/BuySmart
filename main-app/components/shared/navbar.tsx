import Link from 'next/link';
import Image from 'next/image';
import { Suspense } from 'react';
import { ThemeSwitcher } from '@/components/shared/theme-switcher';
import { AuthButton } from '@/components/shared/auth-button';
import { hasEnvVars } from '@/lib/utils';
import { EnvVarWarning } from '@/components/shared/env-var-warning';
import { createClient } from '@/lib/supabase/server';
import { SellerNavLink } from '@/components/shared/seller-nav-link';

export async function Navbar() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;

  let role: 'buyer' | 'seller' | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from('users_profile')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();
    role = (profile?.role as 'buyer' | 'seller' | null) ?? null;
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
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

        {/* Main Nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <SellerNavLink role={role} />
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
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
    </header>
  );
}
