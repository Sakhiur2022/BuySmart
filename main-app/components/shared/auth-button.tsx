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

  const userName =
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
      <div className="relative group">
        <Link
          href="/profile"
          className="text-sm font-medium hover:text-foreground/80"
          aria-haspopup="menu"
        >
          {userName}
        </Link>
        <div className="absolute right-0 z-50 mt-2 hidden w-40 rounded-md border bg-popover p-1 text-popover-foreground shadow-md group-hover:block group-focus-within:block">
          <Link href="/buyer" className="block rounded-sm px-2 py-1.5 text-sm hover:bg-accent">
            Products
          </Link>
          <Link href="/profile" className="block rounded-sm px-2 py-1.5 text-sm hover:bg-accent">
            Profile
          </Link>
        </div>
      </div>
      <LogoutButton />
    </div>
  );
}
