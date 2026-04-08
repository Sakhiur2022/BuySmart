'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { useCart } from '@/lib/context/cart-context';

export function CartManagement() {
  const { items, summary, isLoading, error, updateItemQuantity, removeItem, clearCart } = useCart();
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  const totals = useMemo(() => {
    const totalItems = Number.isFinite(summary.totalItems)
      ? summary.totalItems
      : items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = Number.isFinite(summary.totalAmount)
      ? summary.totalAmount
      : items.reduce((sum, item) => {
          const unitPrice = item.product?.price ?? 0;
          const lineTotal = Number.isFinite(item.line_total)
            ? item.line_total
            : unitPrice * item.quantity;
          return sum + lineTotal;
        }, 0);

    return { totalItems, subtotal };
  }, [items, summary.totalAmount, summary.totalItems]);

  const handleIncrease = async (productId: string, quantity: number) => {
    setPendingProductId(productId);
    try {
      await updateItemQuantity(productId, quantity + 1);
    } finally {
      setPendingProductId(null);
    }
  };

  const handleDecrease = async (productId: string, quantity: number) => {
    setPendingProductId(productId);
    try {
      if (quantity <= 1) {
        await removeItem(productId);
        return;
      }

      await updateItemQuantity(productId, quantity - 1);
    } finally {
      setPendingProductId(null);
    }
  };

  const handleRemove = async (productId: string) => {
    setPendingProductId(productId);
    try {
      await removeItem(productId);
    } finally {
      setPendingProductId(null);
    }
  };

  const handleClearCart = async () => {
    setIsClearing(true);
    try {
      await clearCart();
    } finally {
      setIsClearing(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="border-dashed">
          <CardHeader className="items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShoppingCart className="h-6 w-6" />
            </div>
            <CardTitle>Your cart is empty</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Looks like you have not added any products yet. Start browsing and build your cart.
            </p>
            <Button asChild>
              <Link href="/buyer">Continue shopping</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="space-y-4 lg:col-span-2" aria-label="Cart items">
        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {items.map((item) => {
          const productName = item.product?.name ?? 'Unavailable product';
          const unitPrice = item.product?.price ?? 0;
          const lineTotal = Number.isFinite(item.line_total)
            ? item.line_total
            : unitPrice * item.quantity;
          const imageUrl = item.product?.image?.trim() || null;
          const itemBusy = pendingProductId === item.product_id;

          return (
            <Card key={item.cart_item_id}>
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md border bg-muted">
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={productName}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                        No image
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 space-y-2">
                    <p className="truncate text-sm font-semibold sm:text-base">{productName}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">Unit {formatCurrency(unitPrice)}</Badge>
                      <Badge variant="outline">Line {formatCurrency(lineTotal)}</Badge>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <div className="flex items-center rounded-md border">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="rounded-r-none"
                      onClick={() => handleDecrease(item.product_id, item.quantity)}
                      disabled={itemBusy || isLoading}
                      aria-label={`Decrease quantity for ${productName}`}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="min-w-10 px-3 text-center text-sm font-semibold">{item.quantity}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="rounded-l-none"
                      onClick={() => handleIncrease(item.product_id, item.quantity)}
                      disabled={itemBusy || isLoading}
                      aria-label={`Increase quantity for ${productName}`}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => handleRemove(item.product_id)}
                    disabled={itemBusy || isLoading}
                    aria-label={`Remove ${productName}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <aside className="lg:col-span-1">
        <Card className="lg:sticky lg:top-24">
          <CardHeader>
            <CardTitle>Cart summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Items</span>
              <span className="font-medium">{totals.totalItems}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-3 text-base font-semibold">
              <span>Total</span>
              <span>{formatCurrency(totals.subtotal)}</span>
            </div>

            <Button className="w-full" disabled>
              Checkout
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleClearCart}
              disabled={isClearing || isLoading}
            >
              {isClearing || isLoading ? 'Clearing...' : 'Clear cart'}
            </Button>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
