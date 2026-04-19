"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeftRight,
  BarChart3,
  ClipboardList,
  Menu,
  ShieldCheck,
  ShoppingBag,
  Store,
  X,
} from 'lucide-react';

type NavMenuItem = {
  href: string;
  label: string;
  icon?: 'arrow-left-right' | 'bar-chart-3' | 'clipboard-list' | 'shield-check' | 'shopping-bag' | 'store';
};

type MobileNavMenuProps = {
  items: readonly NavMenuItem[];
};

export function MobileNavMenu({ items }: MobileNavMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Handle click outside to close menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    // Also close on escape key
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  // Close menu when link is clicked
  const handleLinkClick = () => {
    setIsOpen(false);
  };

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  // Only show menu dropdown if there are items
  const hasItems = items && items.length > 0;

  const iconMap = {
    'arrow-left-right': ArrowLeftRight,
    'bar-chart-3': BarChart3,
    'clipboard-list': ClipboardList,
    'shield-check': ShieldCheck,
    'shopping-bag': ShoppingBag,
    store: Store,
  } as const;

  return (
    <div className="relative md:hidden">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleMenu}
        disabled={!hasItems}
        className="inline-flex items-center justify-center rounded-md border border-input bg-background p-2 text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-500/10 dark:hover:text-rose-100 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-expanded={isOpen}
        aria-controls="mobile-nav-menu"
        aria-label={isOpen ? 'Close navigation' : 'Open navigation'}
      >
        {isOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <Menu className="h-5 w-5" />
        )}
      </button>

      {isOpen && hasItems && (
        <div
          ref={menuRef}
          id="mobile-nav-menu"
          className="absolute left-0 top-full z-50 mt-2 w-56 rounded-xl border border-input bg-background shadow-lg"
        >
          <div className="flex flex-col">
            {items.map((item, index) => {
              const Icon = item.icon ? iconMap[item.icon] : null;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-500/10 dark:hover:text-rose-100 ${
                    index === 0 ? 'rounded-t-lg' : ''
                  } ${index === items.length - 1 ? 'rounded-b-lg' : ''}`}
                  onClick={handleLinkClick}
                >
                  {Icon ? <Icon className="h-4 w-4" /> : null}
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
