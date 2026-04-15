import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  const user = data.user;

  if (error || !user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const userId = user.id;

  const { data: profile, error: profileError } = await supabase
    .from('users_profile')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (profile?.role === 'admin' || profile?.role === 'moderator') {
    return NextResponse.json({ error: 'admin_or_moderator' }, { status: 403 });
  }

  if (profile?.role !== 'seller') {
    const { error: upsertError } = await supabase
      .from('users_profile')
      .upsert({ user_id: userId, role: 'seller' }, { onConflict: 'user_id' });

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    const { error: authError } = await supabase.auth.updateUser({
      data: { role: 'seller' },
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
