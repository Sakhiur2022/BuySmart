import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  const user = data.user;

  if (error || !user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from('users_profile')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const fullName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    null;

  return NextResponse.json({
    userId: user.id,
    email: user.email ?? null,
    fullName,
    role: profile?.role ?? null,
  });
}
