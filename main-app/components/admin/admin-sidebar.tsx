'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ListTree, Menu, Package, Settings, Users, X, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const primaryLinks = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/categories', label: 'Categories', icon: ListTree },
];

const comingSoonLinks = [
  { label: 'Users', icon: Users },
  { label: 'Products', icon: Package },
  { label: 'Settings', icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <div className="sticky top-0 z-40 flex items-center justify-between border-b bg-background px-4 py-3 md:hidden">
        <p className="text-sm font-semibold">Admin Portal</p>
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-label="Toggle admin menu"
        >
          {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 w-64 border-r bg-muted/40 p-4 transition-transform md:static md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="mb-6 hidden md:block">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Admin Portal
          </p>
        </div>

        <nav className="space-y-1">
          {primaryLinks.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;

            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 space-y-1">
          <p className="px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Coming Soon
          </p>
          {comingSoonLinks.map(({ label, icon: Icon }) => (
            <button
              key={label}
              type="button"
              disabled
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground/70"
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </aside>

      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close admin menu"
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}
    </>
  );
}
