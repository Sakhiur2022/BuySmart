import { redirect } from 'next/navigation';
import { SellerSettingsForm } from '@/components/forms/seller-settings-form';
import { createClient } from '@/lib/supabase/server';

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

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export default async function SellerSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const { data: profile } = await supabase
    .from('users_profile')
    .select('role, preferences, updated_at, avatar_url')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profile?.role !== 'seller') {
    redirect('/buyer');
  }

  const preferences = toRecord(profile?.preferences);
  const sellerSettings = toRecord(preferences.sellerSettings);
  const metadata = toRecord(user.user_metadata ?? {});
  const initialAvatarUrl =
    (profile?.avatar_url as string | undefined) ||
    (metadata.avatar_url as string | undefined) ||
    (metadata.picture as string | undefined) ||
    null;
  const displayName =
    (metadata.full_name as string | undefined) ||
    (metadata.name as string | undefined) ||
    (user.email ?? 'User');

  const initialSettings: SellerSettings = {
    storeName: readString(sellerSettings.storeName, ''),
    tagline: readString(sellerSettings.tagline, ''),
    supportEmail: readString(sellerSettings.supportEmail, user.email ?? ''),
    supportPhone: readString(sellerSettings.supportPhone, ''),
    shippingOrigin: readString(sellerSettings.shippingOrigin, ''),
    returnWindowDays: readNumber(sellerSettings.returnWindowDays, 30),
    returnPolicy: readString(sellerSettings.returnPolicy, ''),
    lowStockThreshold: readNumber(sellerSettings.lowStockThreshold, 5),
    autoPublish: readBoolean(sellerSettings.autoPublish, false),
    orderNotifications: readBoolean(sellerSettings.orderNotifications, true),
    marketingTips: readBoolean(sellerSettings.marketingTips, true),
    vacationMode: readBoolean(sellerSettings.vacationMode, false),
  };

  return (
    <div className="space-y-6">
      <SellerSettingsForm
        userId={user.id}
        initialAvatarUrl={initialAvatarUrl}
        displayName={displayName}
        initialSettings={initialSettings}
        initialUpdatedAt={profile?.updated_at ?? null}
      />
    </div>
  );
}
