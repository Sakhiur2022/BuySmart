import Link from 'next/link';
import Image from 'next/image';
import { Suspense } from 'react';
import { ThemeSwitcher } from '@/components/shared/theme-switcher';
import { AuthButton } from '@/components/shared/auth-button';
import { hasEnvVars } from '@/lib/utils';
import { EnvVarWarning } from '@/components/shared/env-var-warning';
import logo from '@/public/icons/CSE327_Logo_red.jpg';

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand - Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Image
            src={logo}
            alt="CSE327 Logo"
            height={40}
            width={140}
            priority
            className="object-contain h-8 w-auto md:h-10"
          />
        </Link>

        {/* Main Nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <Link
            href="/buyer"
            className="rounded-full border border-pink-300/70 bg-linear-to-r from-pink-100 via-rose-100 to-amber-100 px-4 py-1.5 font-semibold text-rose-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:from-pink-200 hover:to-amber-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 dark:border-pink-500/40 dark:from-rose-900/40 dark:via-pink-900/30 dark:to-amber-900/30 dark:text-pink-100"
            title="Browse products"
          >
            Products
          </Link>
          <Link
            href="/profile"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Profile
          </Link>
          <Link
            href="/profile/settings"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Settings
          </Link>
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
