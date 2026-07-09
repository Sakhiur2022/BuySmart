'use client';

import { useEffect, useState } from 'react';
import { BarChart3, Bot, ClipboardList, PackageSearch, X } from 'lucide-react';

const STORAGE_KEY = 'buysmart.seller-onboarding.seen';
const SECTION_IDS = [
  { id: 'seller-listings', label: 'Listings', icon: PackageSearch },
  { id: 'seller-orders', label: 'Orders', icon: ClipboardList },
  { id: 'seller-analytics', label: 'Analytics', icon: BarChart3 },
] as const;

function scrollToSection(id: string) {
  const element = document.getElementById(id);
  element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function SellerMascotWelcome() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    try {
      setIsVisible(window.localStorage.getItem(STORAGE_KEY) !== '1');
    } catch {
      setIsVisible(true);
    }
  }, []);

  if (!isVisible) {
    return null;
  }

  const dismiss = () => {
    setIsVisible(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // Ignore storage issues.
    }
  };

  return (
    <div className="fixed right-4 top-4 z-[210] w-[min(24rem,calc(100vw-2rem))] rounded-3xl border border-rose-100 bg-white/95 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.16)] backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500 text-white shadow-[0_12px_28px_rgba(244,63,94,0.22)]">
          <Bot className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-500/80">
                Seller guide
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">I&apos;ll show you the fast lane</h2>
            </div>
            <button
              type="button"
              onClick={dismiss}
              className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="Dismiss seller guide"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Start with Listings, check Orders, then review Analytics. When you are ready, I will
            hand you to the bot for listing creation and refund help.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {SECTION_IDS.map((section) => {
          const Icon = section.icon;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => scrollToSection(section.id)}
              className="inline-flex items-center gap-2 rounded-full border border-rose-100 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:-translate-y-0.5 hover:bg-rose-100"
            >
              <Icon className="h-3.5 w-3.5" />
              {section.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(new CustomEvent('buysmart:seller-open-chat'));
            dismiss();
          }}
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800"
        >
          Open bot
        </button>
      </div>
    </div>
  );
}
