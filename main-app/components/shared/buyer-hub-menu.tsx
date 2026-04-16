"use client";

import { useState } from 'react';
import Link from 'next/link';
import { Menu } from 'lucide-react';

type BuyerHubItem = {
  href: string;
  label: string;
};

type BuyerHubMenuProps = {
  items: BuyerHubItem[];
};

export function BuyerHubMenu({ items }: BuyerHubMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="inline-flex items-center justify-center rounded-md border border-input bg-background p-2 text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-500/10 dark:hover:text-rose-100"
        aria-expanded={isOpen}
        aria-controls="buyer-hub-nav"
        aria-label="Toggle buyer navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {isOpen ? (
        <div
          id="buyer-hub-nav"
          className="absolute left-0 top-full z-50 mt-2 w-64 rounded-xl border bg-background p-2 shadow-lg"
        >
          <div className="flex flex-col gap-1">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-500/10 dark:hover:text-rose-100"
                onClick={() => setIsOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
