import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { CartManagement } from '@/components/cart/cart-management';
import { Button } from '@/components/ui/button';

export default function BuyerCartPage() {
  const continueShoppingHref = '/buyer?mode=buyer';
  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-linear-to-r from-primary/10 via-card to-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold sm:text-3xl">Your Cart</h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Review items, update quantities, remove products, and continue to checkout.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href={continueShoppingHref}>
              <ShoppingBag className="mr-2 h-4 w-4" />
              Continue shopping
            </Link>
          </Button>
        </div>
      </section>

      <CartManagement />
    </div>
  );
}
