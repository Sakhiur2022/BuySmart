import { redirect } from 'next/navigation';
import { UserProfileForm } from '@/components/forms/user-profile-form';
import { createClient } from '@/lib/supabase/server';

export default async function UserProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const { data: profile } = await supabase
    .from('users_profile')
    .select('full_name, display_name, avatar_url, phone, role, profile_completed, updated_at')
    .eq('user_id', user.id)
    .maybeSingle();

  const hasProfileRecord = Boolean(profile);
  const emailConfirmed = Boolean(user.email_confirmed_at);

  const userMetadata = user.user_metadata ?? {};

  const initialProfile = {
    fullName:
      (profile?.full_name as string | null) ??
      (userMetadata.full_name as string | undefined) ??
      (userMetadata.name as string | undefined) ??
      '',
    displayName: (profile?.display_name as string | null) ?? '',
    avatarUrl:
      (profile?.avatar_url as string | null) ??
      (userMetadata.avatar_url as string | undefined) ??
      (userMetadata.picture as string | undefined) ??
      '',
    phone: (profile?.phone as string | null) ?? (userMetadata.phone as string | undefined) ?? '',
    role: (profile?.role as string | null) ?? 'buyer',
    profileCompleted: profile?.profile_completed ?? false,
    updatedAt: (profile?.updated_at as string | null) ?? null,
  };

  return (
    <div className="space-y-6">
      <UserProfileForm
        userId={user.id}
        email={user.email ?? 'No email'}
        emailConfirmed={emailConfirmed}
        hasProfileRecord={hasProfileRecord}
        initialProfile={initialProfile}
      />
    </div>
  );
}
