'use client';

import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/lib/context/cart-context';

export function CartNavButton() {
  const { items, summary } = useCart();

  const itemCount = useMemo(() => {
    if (Number.isFinite(summary.totalItems)) {
      return summary.totalItems;
    }

    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items, summary.totalItems]);

  const badgeLabel = itemCount > 99 ? '99+' : String(itemCount);

  return (
    <Button
      asChild
      variant="outline"
      size="icon"
      className="relative border-primary/30 bg-linear-to-br from-primary/10 via-background to-background hover:bg-background"
      aria-label="Open cart"
    >
      <Link href="/buyer/cart" title="Go to cart">
        <ShoppingCart className="h-4 w-4" />
        {itemCount > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-linear-to-r from-primary to-primary/80 px-1 text-[10px] font-semibold text-primary-foreground shadow-sm">
            {badgeLabel}
          </span>
        ) : null}
      </Link>
    </Button>
  );
}
