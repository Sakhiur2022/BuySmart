import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    const redirectUrl = new URL('/auth/error', origin);
    redirectUrl.searchParams.set('error', 'logout_failed');
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.redirect(`${origin}/`);
}
