'use client';

import { usePathname } from 'next/navigation';

const PROMOS = [
  {
    id: 'deals',
    title: 'New Deals Today',
    detail: 'Up to 30% off smart home favorites.',
  },
  {
    id: 'shipping',
    title: 'Free Shipping',
    detail: 'Orders over $50 ship on us.',
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
          <div className="flex w-max items-center gap-6 pr-6 banner-marquee">
            {PROMOS.map((promo) => (
              <span
                key={`promo-a-${promo.id}`}
                className="inline-flex items-center gap-2 whitespace-nowrap"
              >
                <span>{promo.title}</span>
                <span className="text-rose-500/80">•</span>
                <span className="text-rose-600/90">{promo.detail}</span>
              </span>
            ))}
            {PROMOS.map((promo) => (
              <span
                key={`promo-b-${promo.id}`}
                className="inline-flex items-center gap-2 whitespace-nowrap"
              >
                <span>{promo.title}</span>
                <span className="text-rose-500/80">•</span>
                <span className="text-rose-600/90">{promo.detail}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
      <style jsx>{`
        .banner-marquee {
          animation: banner-marquee 22s linear infinite;
        }

        @keyframes banner-marquee {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .banner-marquee {
            animation: none;
            transform: none;
          }
        }
      `}</style>
    </div>
  );
}
