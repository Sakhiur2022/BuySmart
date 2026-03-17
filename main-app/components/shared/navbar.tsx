import Link from 'next/link';
import { Suspense } from 'react';
import { ShoppingBag } from 'lucide-react';
import { ThemeSwitcher } from '@/components/shared/theme-switcher';
import { AuthButton } from '@/components/shared/auth-button';
import { hasEnvVars } from '@/lib/utils';
import { EnvVarWarning } from '@/components/shared/env-var-warning';

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <ShoppingBag className="h-5 w-5 text-primary" />
          <span>BuySmart</span>
        </Link>

        {/* Main Nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <Link
            href="/protected/products"
            className="text-muted-foreground hover:text-foreground transition-colors"
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
