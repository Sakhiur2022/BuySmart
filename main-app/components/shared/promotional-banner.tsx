'use client';

import { usePathname } from 'next/navigation';
import { ShoppingBag } from 'lucide-react';

const PROMOS = [
  {
    id: 'coupon-save10',
    title: 'Coupon SAVE10',
    detail: 'Get 10% off on your next order.',
  },
  {
    id: 'coupon-save20',
    title: 'Coupon SAVE20',
    detail: 'Get 20% off selected items today.',
  },
  {
    id: 'coupon-flat200',
    title: 'Coupon FLAT200',
    detail: 'Instant BDT 200 off on eligible carts.',
  },
  {
    id: 'deals',
    title: 'New Deals Today',
    detail: 'Up to 30% off smart home favorites.',
  },
  {
    id: 'shipping',
    title: 'Free Shipping',
    detail: 'Orders over BDT 2000 ship on us.',
  },
  {
    id: 'seller-week',
    title: 'Seller Week',
    detail: 'Zero listing fees through Friday.',
  },
  {
    id: 'drops',
    title: 'Fresh Drops',
    detail: 'New arrivals land every morning.',
  },
];

type PromotionalBannerProps = {
  visiblePaths?: string[];
};

export function PromotionalBanner({ visiblePaths }: PromotionalBannerProps) {
  const pathname = usePathname();

  if (visiblePaths && !visiblePaths.includes(pathname)) {
    return null;
  }

  return (
    <div className="w-full border-b border-rose-200/70 bg-linear-to-r from-rose-100 via-pink-100 to-amber-100 px-4 py-2 text-rose-700">
      <div className="mx-auto flex max-w-7xl items-center gap-3 text-xs font-semibold sm:text-sm">
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-rose-600 shadow-sm sm:text-[11px]">
          Hot
        </span>
        <div className="relative flex-1 overflow-hidden">
          <div className="flex w-max items-center gap-4 pr-6 banner-marquee">
            {PROMOS.map((promo) => (
              <span
                key={`promo-a-${promo.id}`}
                className="inline-flex items-center gap-4 whitespace-nowrap"
              >
                <span>{promo.title}</span>
                <ShoppingBag className="h-3.5 w-3.5 text-rose-500/80" aria-hidden="true" />
                <span className="text-rose-600/90">{promo.detail}</span>
                <ShoppingBag className="h-3.5 w-3.5 text-rose-500/80" aria-hidden="true" />
              </span>
            ))}
            {PROMOS.map((promo) => (
              <span
                key={`promo-b-${promo.id}`}
                className="inline-flex items-center gap-4 whitespace-nowrap"
              >
                <span>{promo.title}</span>
                <ShoppingBag className="h-3.5 w-3.5 text-rose-500/80" aria-hidden="true" />
                <span className="text-rose-600/90">{promo.detail}</span>
                <ShoppingBag className="h-3.5 w-3.5 text-rose-500/80" aria-hidden="true" />
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
