import Link from 'next/link';
import { LayoutDashboard, Package, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const sellerNav = [
  { href: '/seller', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/seller/products', label: 'My Products', icon: Package },
  { href: '/seller/products/new', label: 'Add Product', icon: PlusCircle },
];

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1">
      {/* Sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r bg-muted/40 py-6 px-3 gap-1">
        <p className="px-3 mb-2 text-xs font-semibold uppercase text-muted-foreground tracking-wider">
          Seller Portal
        </p>
        {sellerNav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </aside>

      {/* Content */}
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  );
}
