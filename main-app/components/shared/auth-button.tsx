import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { LogoutButton } from './logout-button';

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

  // Fetch user profile to get display_name
  const { data: userProfile } = await supabase
    .from('users_profile')
    .select('display_name')
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
    (user.user_metadata?.avatar_url as string) || (user.user_metadata?.picture as string);

  return (
    <div className="flex items-center gap-3">
      {avatarUrl && (
        <Image src={avatarUrl} alt={userName} width={32} height={32} className="rounded-full" />
      )}
      <Link
        href="/profile"
        className="text-sm font-medium hover:text-foreground/80"
        title="Go to profile"
        aria-label={`Go to profile: ${userName}`}
      >
        {userName}
      </Link>
      <LogoutButton />
    </div>
  );
}
