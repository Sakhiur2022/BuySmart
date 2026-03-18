'use server';

import { createClient } from '@/lib/supabase/server';

type UserSettingsPreferences = {
  emailNotifications: boolean;
  productAlerts: boolean;
  marketingEmails: boolean;
  publicProfile: boolean;
  theme: 'system' | 'light' | 'dark';
  timezone: string;
};

export async function savePreferences(userId: string, preferences: UserSettingsPreferences) {
  try {
    const supabase = await createClient();
    const now = new Date().toISOString();

    // Update users_profile table
    const { error: profileError } = await supabase
      .from('users_profile')
      .update({
        preferences,
        updated_at: now,
      })
      .eq('user_id', userId);

    if (profileError) {
      throw profileError;
    }

    // Update auth metadata
    const { error: metadataError } = await supabase.auth.updateUser({
      data: {
        email_notifications: preferences.emailNotifications,
        product_alerts: preferences.productAlerts,
        marketing_emails: preferences.marketingEmails,
        public_profile: preferences.publicProfile,
        theme_preference: preferences.theme,
        timezone: preferences.timezone,
      },
    });

    if (metadataError) {
      console.warn('Auth metadata sync warning:', metadataError);
      // Don't throw - preferences are already saved in the DB
    }

    return {
      success: true,
      updatedAt: now,
      error: null,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save preferences';
    return {
      success: false,
      error: message,
      updatedAt: null,
    };
  }
}
