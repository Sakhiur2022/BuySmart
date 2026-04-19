import Image from 'next/image';
import Link from 'next/link';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { LogoutButton } from './logout-button';
import { NavbarRoleActions } from './navbar-role-actions';
import { ThemeSwitcher } from '@/components/shared/theme-switcher';

export async function AuthButton() {
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;

  if (!user) {
    return (
      <div className="flex gap-2">
        <Button asChild size="sm" variant={'outline'}>
          <Link href="/auth/login">Sign in</Link>
        </Button>
        <Button asChild size="sm" variant={'default'}>
          <Link href="/auth/sign-up">Sign up</Link>
        </Button>
      </div>
    );
  }

  // Fetch user profile to get display_name and avatar_url
  const { data: userProfile } = await supabase
    .from('users_profile')
    .select('display_name, avatar_url, role')
    .eq('user_id', user.id)
    .single();

  // Use display_name if it exists and is not empty
  // Otherwise, fall back to metadata (full_name or name), email, or 'User'
  const userName =
    (userProfile?.display_name && userProfile.display_name.trim()) ||
    (user.user_metadata?.full_name as string) ||
    (user.user_metadata?.name as string) ||
    user.email ||
    'User';

  const avatarUrl =
    (userProfile?.avatar_url && userProfile.avatar_url.trim()) ||
    (user.user_metadata?.avatar_url as string) ||
    (user.user_metadata?.picture as string);

  const role = (userProfile?.role as 'buyer' | 'seller' | 'admin' | 'moderator' | null) ?? null;

  return (
    <div className="flex items-center gap-2">
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
      <div className="ml-2">
        <NavbarRoleActions role={role} />
      </div>
      <ThemeSwitcher />
      <Link
        href="/profile/settings"
        className="inline-flex items-center text-rose-700 transition-colors hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 dark:text-pink-100 dark:hover:text-pink-100"
        title="Settings"
        aria-label="Settings"
      >
        <Settings className="h-4 w-4" aria-hidden="true" />
      </Link>
      <LogoutButton />
    </div>
  );
}
