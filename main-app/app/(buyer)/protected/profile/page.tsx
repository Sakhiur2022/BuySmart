import { redirect } from 'next/navigation';
import { UserProfileForm } from '@/components/forms/user-profile-form';
import { createClient } from '@/lib/supabase/server';
import { getServiceRoleSupabase } from '@/lib/supabase/service-role';

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

  const userMetadata = user.user_metadata ?? {};
  let resolvedProfile = profile ?? null;

  if (!resolvedProfile) {
    const serviceRole = getServiceRoleSupabase();
    if (serviceRole) {
      const now = new Date().toISOString();
      await serviceRole.from('users_profile').upsert(
        {
          user_id: user.id,
          full_name: (userMetadata.full_name as string | undefined) ?? (userMetadata.name as string | undefined) ?? null,
          display_name: null,
          avatar_url:
            (userMetadata.avatar_url as string | undefined) ??
            (userMetadata.picture as string | undefined) ??
            null,
          phone: (userMetadata.phone as string | undefined) ?? null,
          role: 'buyer',
          profile_completed: false,
          updated_at: now,
        },
        { onConflict: 'user_id' },
      );

      const { data: refreshedProfile } = await serviceRole
        .from('users_profile')
        .select('full_name, display_name, avatar_url, phone, role, profile_completed, updated_at')
        .eq('user_id', user.id)
        .maybeSingle();

      resolvedProfile = refreshedProfile ?? resolvedProfile;
    }
  }

  const emailConfirmed = Boolean(user.email_confirmed_at);
  const hasProfileRecord = Boolean(resolvedProfile);

  const initialProfile = {
    fullName:
      (resolvedProfile?.full_name as string | null) ??
      (userMetadata.full_name as string | undefined) ??
      (userMetadata.name as string | undefined) ??
      '',
    displayName: (resolvedProfile?.display_name as string | null) ?? '',
    avatarUrl:
      (resolvedProfile?.avatar_url as string | null) ??
      (userMetadata.avatar_url as string | undefined) ??
      (userMetadata.picture as string | undefined) ??
      '',
    phone:
      (resolvedProfile?.phone as string | null) ?? (userMetadata.phone as string | undefined) ?? '',
    role: (resolvedProfile?.role as string | null) ?? 'buyer',
    profileCompleted: resolvedProfile?.profile_completed ?? false,
    updatedAt: (resolvedProfile?.updated_at as string | null) ?? null,
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-semibold sm:text-3xl">My Profile</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
          View and manage your account details. Changes are saved to your Supabase profile and
          synced to auth metadata.
        </p>
      </section>

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
