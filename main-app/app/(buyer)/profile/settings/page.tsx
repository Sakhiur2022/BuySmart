import { redirect } from 'next/navigation';
import { UserSettingsForm } from '../../../../components/forms/user-settings-form';
import { createClient } from '@/lib/supabase/server';

type ThemePreference = 'system' | 'light' | 'dark';

type UserSettingsPreferences = {
  emailNotifications: boolean;
  productAlerts: boolean;
  marketingEmails: boolean;
  publicProfile: boolean;
  theme: ThemePreference;
  timezone: string;
};

const ALLOWED_THEMES = new Set<ThemePreference>(['system', 'light', 'dark']);
const ALLOWED_TIMEZONES = new Set<string>([
  'UTC',
  'Asia/Dhaka',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Europe/London',
  'America/New_York',
]);

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readTheme(value: unknown): ThemePreference {
  if (typeof value === 'string' && ALLOWED_THEMES.has(value as ThemePreference)) {
    return value as ThemePreference;
  }

  return 'system';
}

function readTimezone(value: unknown): string {
  if (typeof value === 'string' && ALLOWED_TIMEZONES.has(value)) {
    return value;
  }

  return 'UTC';
}

export default async function UserSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const { data: profile } = await supabase
    .from('users_profile')
    .select('role, email_verified, preferences, updated_at')
    .eq('user_id', user.id)
    .maybeSingle();

  const hasProfileRecord = Boolean(profile);
  const profilePreferences = toRecord(profile?.preferences);
  const metadata = toRecord(user.user_metadata ?? {});

  const initialPreferences: UserSettingsPreferences = {
    emailNotifications: readBoolean(
      profilePreferences.emailNotifications,
      readBoolean(metadata.email_notifications, true),
    ),
    productAlerts: readBoolean(
      profilePreferences.productAlerts,
      readBoolean(metadata.product_alerts, true),
    ),
    marketingEmails: readBoolean(
      profilePreferences.marketingEmails,
      readBoolean(metadata.marketing_emails, false),
    ),
    publicProfile: readBoolean(
      profilePreferences.publicProfile,
      readBoolean(metadata.public_profile, false),
    ),
    theme: readTheme(profilePreferences.theme ?? metadata.theme_preference),
    timezone: readTimezone(profilePreferences.timezone ?? metadata.timezone),
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-semibold sm:text-3xl">Settings</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
          Manage your account preferences, password, and personalization options.
        </p>
      </section>

      <UserSettingsForm
        userId={user.id}
        email={user.email ?? 'No email'}
        role={(profile?.role as string | null) ?? 'buyer'}
        emailVerified={profile?.email_verified ?? Boolean(user.email_confirmed_at)}
        hasProfileRecord={hasProfileRecord}
        initialUpdatedAt={(profile?.updated_at as string | null) ?? null}
        initialPreferences={initialPreferences}
      />
    </div>
  );
}