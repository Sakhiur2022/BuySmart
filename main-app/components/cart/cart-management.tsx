'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/utils';
import { useCart } from '@/lib/context/cart-context';

type VoucherRule =
  | { code: string; type: 'percent'; value: number; label: string }
  | { code: string; type: 'flat'; value: number; label: string };

const VOUCHER_RULES: VoucherRule[] = [
  { code: 'SAVE10', type: 'percent', value: 10, label: '10% OFF' },
  { code: 'SAVE20', type: 'percent', value: 20, label: '20% OFF' },
  { code: 'FLAT200', type: 'flat', value: 200, label: 'BDT 200 OFF' },
];

export function CartManagement() {
  const router = useRouter();
  const { items, summary, isLoading, error, updateItemQuantity, removeItem, clearCart } = useCart();
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [voucherInput, setVoucherInput] = useState('');
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [appliedVoucher, setAppliedVoucher] = useState<VoucherRule | null>(null);
  const continueShoppingHref = '/buyer?mode=buyer';

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
      setAppliedVoucher(null);
      setVoucherInput('');
      setVoucherError(null);
    } finally {
      setIsClearing(false);
    }
  };

  const discountAmount = useMemo(() => {
    if (!appliedVoucher) {
      return 0;
    }

    if (appliedVoucher.type === 'percent') {
      return (totals.subtotal * appliedVoucher.value) / 100;
    }

    return Math.min(appliedVoucher.value, totals.subtotal);
  }, [appliedVoucher, totals.subtotal]);

  const totalAfterDiscount = Math.max(0, totals.subtotal - discountAmount);
  const isCheckoutDisabled = isLoading || pendingProductId !== null || isClearing;

  const handleApplyVoucher = () => {
    const normalized = voucherInput.trim().toUpperCase();

    if (!normalized) {
      setVoucherError('Please enter a voucher code.');
      setAppliedVoucher(null);
      return;
    }

    const matched = VOUCHER_RULES.find((rule) => rule.code === normalized);
    if (!matched) {
      setVoucherError('Invalid voucher code.');
      setAppliedVoucher(null);
      return;
    }

    setAppliedVoucher(matched);
    setVoucherError(null);
  };

  const handleRemoveVoucher = () => {
    setAppliedVoucher(null);
    setVoucherError(null);
    setVoucherInput('');
  };

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="border-dashed bg-linear-to-br from-primary/5 via-card to-card">
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
              <Link href={continueShoppingHref}>Continue shopping</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="relative z-0 space-y-4 lg:col-span-2" aria-label="Cart items">
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
            <Card
              key={item.cart_item_id}
              className="bg-linear-to-r from-background via-background to-primary/5"
            >
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
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>
                        Price:{' '}
                        <span className="font-medium text-foreground">
                          {formatCurrency(unitPrice)}
                        </span>
                      </p>
                      <p>
                        Subtotal:{' '}
                        <span className="font-medium text-foreground">
                          {formatCurrency(lineTotal)}
                        </span>
                      </p>
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
                    <span className="min-w-10 px-3 text-center text-sm font-semibold">
                      {item.quantity}
                    </span>
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

      <aside className="relative z-20 isolate space-y-4 lg:col-span-1">
        <Card className="relative overflow-hidden border-rose-200/80 bg-linear-to-br from-rose-50 via-pink-50 to-amber-50 dark:border-rose-500/30 dark:from-rose-950/35 dark:via-pink-950/25 dark:to-amber-950/20">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-background"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-background"
          />
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-rose-700 dark:text-rose-300">Coupon</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 border-t border-dashed border-rose-300/70 pt-3 dark:border-rose-500/40">
            <div className="flex gap-2">
              <Input
                value={voucherInput}
                onChange={(event) => setVoucherInput(event.target.value)}
                placeholder="Enter code"
                className="h-9"
                aria-label="Voucher code"
              />
              <Button type="button" size="sm" onClick={handleApplyVoucher}>
                Apply
              </Button>
            </div>
            {voucherError ? <p className="text-xs text-destructive">{voucherError}</p> : null}
            {!voucherError && appliedVoucher ? (
              <div className="flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-300">
                <span>
                  Applied: {appliedVoucher.code} ({appliedVoucher.label})
                </span>
                <button
                  type="button"
                  className="underline underline-offset-2"
                  onClick={handleRemoveVoucher}
                >
                  Remove
                </button>
              </div>
            ) : null}
            <p className="text-[11px] text-muted-foreground">Try: SAVE10, SAVE20, FLAT200</p>
          </CardContent>
        </Card>

        <Card className="relative z-30 bg-linear-to-br from-primary/10 via-card to-card lg:sticky lg:top-24">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 leading-normal">
              <ShoppingCart className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <span>Cart summary</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-30 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Items</span>
              <span className="font-medium">{totals.totalItems}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
            </div>
            {discountAmount > 0 ? (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Discount</span>
                <span className="font-medium text-emerald-700 dark:text-emerald-300">
                  -{formatCurrency(discountAmount)}
                </span>
              </div>
            ) : null}
            <div className="flex items-center justify-between border-t pt-3 text-base font-semibold">
              <span>Total</span>
              <span>{formatCurrency(totalAfterDiscount)}</span>
            </div>

            <Button
              type="button"
              className="relative z-20 w-full"
              onClick={() => router.push('/buyer/checkout')}
              disabled={isCheckoutDisabled}
            >
              Checkout
            </Button>
            <Button
              variant="outline"
              className="relative z-20 w-full"
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
