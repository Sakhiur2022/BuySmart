import { redirect } from 'next/navigation';
import { SellerSettingsForm } from '@/components/forms/seller-settings-form';
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

type SellerSettings = {
  storeName: string;
  tagline: string;
  supportEmail: string;
  supportPhone: string;
  shippingOrigin: string;
  returnWindowDays: number;
  returnPolicy: string;
  lowStockThreshold: number;
  autoPublish: boolean;
  orderNotifications: boolean;
  marketingTips: boolean;
  vacationMode: boolean;
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

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
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
    .select('role, email_verified, preferences, updated_at, avatar_url')
    .eq('user_id', user.id)
    .maybeSingle();

  const hasProfileRecord = Boolean(profile);
  const profilePreferences = toRecord(profile?.preferences);
  const sellerPreferences = toRecord(profilePreferences.sellerSettings);
  const metadata = toRecord(user.user_metadata ?? {});
  const role = (profile?.role as string | null) ?? 'buyer';
  const initialAvatarUrl =
    (profile?.avatar_url as string | undefined) ||
    (metadata.avatar_url as string | undefined) ||
    (metadata.picture as string | undefined) ||
    null;
  const displayName =
    (metadata.full_name as string | undefined) ||
    (metadata.name as string | undefined) ||
    (user.email ?? 'User');

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

  const initialSellerSettings: SellerSettings = {
    storeName: readString(sellerPreferences.storeName, ''),
    tagline: readString(sellerPreferences.tagline, ''),
    supportEmail: readString(sellerPreferences.supportEmail, user.email ?? ''),
    supportPhone: readString(sellerPreferences.supportPhone, ''),
    shippingOrigin: readString(sellerPreferences.shippingOrigin, ''),
    returnWindowDays: readNumber(sellerPreferences.returnWindowDays, 30),
    returnPolicy: readString(sellerPreferences.returnPolicy, ''),
    lowStockThreshold: readNumber(sellerPreferences.lowStockThreshold, 5),
    autoPublish: readBoolean(sellerPreferences.autoPublish, false),
    orderNotifications: readBoolean(sellerPreferences.orderNotifications, true),
    marketingTips: readBoolean(sellerPreferences.marketingTips, true),
    vacationMode: readBoolean(sellerPreferences.vacationMode, false),
  };

  return (
    <div className="space-y-6">
      <UserSettingsForm
        userId={user.id}
        email={user.email ?? 'No email'}
        role={role}
        initialAvatarUrl={initialAvatarUrl}
        displayName={displayName}
        emailVerified={profile?.email_verified ?? Boolean(user.email_confirmed_at)}
        hasProfileRecord={hasProfileRecord}
        initialUpdatedAt={(profile?.updated_at as string | null) ?? null}
        initialPreferences={initialPreferences}
      />
      {role === 'seller' ? (
        <div className="pt-6">
          <SellerSettingsForm
            userId={user.id}
            initialAvatarUrl={initialAvatarUrl}
            displayName={displayName}
            initialSettings={initialSellerSettings}
            initialUpdatedAt={(profile?.updated_at as string | null) ?? null}
          />
        </div>
      ) : null}
    </div>
  );
}
