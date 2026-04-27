'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings } from 'lucide-react';
import { LogoutButton } from './logout-button';
import { NavbarRoleActions } from './navbar-role-actions';
import { ThemeSwitcher } from '@/components/shared/theme-switcher';

type NavbarRole = 'buyer' | 'seller' | 'admin' | 'moderator' | null;

type AuthUserLinksProps = {
  avatarUrl?: string;
  role: NavbarRole;
  userName: string;
};

export function AuthUserLinks({ avatarUrl, role, userName }: AuthUserLinksProps) {
  const pathname = usePathname();
  const isInProfileSection = pathname.startsWith('/profile');
  const isOnProfileSettings = pathname.startsWith('/profile/settings');

  return (
    <div className="flex items-center gap-2">
      {!isInProfileSection ? (
        <Link
          href="/profile"
          className="relative inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-full text-rose-700 transition-colors hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 dark:text-pink-100 dark:hover:text-pink-100"
          title="Go to profile"
          aria-label={`Go to profile: ${userName}`}
        >
          {avatarUrl ? (
            <Image src={avatarUrl} alt={userName} fill className="object-cover" sizes="28px" />
          ) : (
            <span className="text-xs font-semibold">
              {userName.charAt(0).toUpperCase()}
            </span>
          )}
        </Link>
      ) : null}
      <div className="ml-2">
        <NavbarRoleActions role={role} />
      </div>
      <ThemeSwitcher />
      {!isOnProfileSettings ? (
        <Link
          href="/profile/settings"
          className="inline-flex items-center text-rose-700 transition-colors hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 dark:text-pink-100 dark:hover:text-pink-100"
          title="Settings"
          aria-label="Settings"
        >
          <Settings className="h-4 w-4" aria-hidden="true" />
        </Link>
      ) : null}
      <LogoutButton />
    </div>
  );
}
