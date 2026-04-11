'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { handleAvatarRemove, handleAvatarUpload } from '@/lib/services/avatar-service';

type UserSettingsPreferences = {
  emailNotifications: boolean;
  productAlerts: boolean;
  marketingEmails: boolean;
  publicProfile: boolean;
  theme: 'system' | 'light' | 'dark';
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

// FIX: Added Server Action to use server client (reads session cookies)
// instead of browser client which has no access to server-side session
export async function updatePassword(newPassword: string) {
  try {
    const supabase = await createClient();

    // FIX: Verify session exists before calling updateUser
    const {
      data: { user },
      error: sessionError,
    } = await supabase.auth.getUser();

    if (sessionError || !user) {
      return {
        success: false,
        error: 'Session expired. Please log in again.',
      };
    }

    // FIX: Use server client with valid session to update password
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      error: null,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update password';
    return {
      success: false,
      error: message,
    };
  }
}

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

export async function saveSellerSettings(userId: string, settings: SellerSettings) {
  try {
    const supabase = await createClient();
    const now = new Date().toISOString();

    const { data: profile, error: profileError } = await supabase
      .from('users_profile')
      .select('preferences')
      .eq('user_id', userId)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    const currentPreferences = toRecord(profile?.preferences);
    const nextPreferences = {
      ...currentPreferences,
      sellerSettings: {
        ...settings,
        updatedAt: now,
      },
    };

    const { error: updateError } = await supabase
      .from('users_profile')
      .update({
        preferences: nextPreferences,
        updated_at: now,
      })
      .eq('user_id', userId);

    if (updateError) {
      throw updateError;
    }

    return {
      success: true,
      updatedAt: now,
      error: null,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save seller settings';
    return {
      success: false,
      error: message,
      updatedAt: null,
    };
  }
}

export async function uploadAvatarAction(formData: FormData) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        success: false,
        avatarUrl: null,
        error: 'Session expired. Please log in again.',
      };
    }

    const userId = formData.get('userId');
    const file = formData.get('avatarFile');
    const previousStoragePath = formData.get('previousStoragePath');

    if (typeof userId !== 'string' || userId !== user.id) {
      return {
        success: false,
        avatarUrl: null,
        error: 'Unauthorized avatar upload request.',
      };
    }

    if (!(file instanceof File)) {
      return {
        success: false,
        avatarUrl: null,
        error: 'Please choose an image file before uploading.',
      };
    }

    const uploadResult = await handleAvatarUpload({
      userId,
      file,
      previousStoragePath: typeof previousStoragePath === 'string' ? previousStoragePath : null,
    });

    if (!uploadResult.success) {
      return {
        success: false,
        avatarUrl: null,
        error: uploadResult.error,
      };
    }

    revalidatePath('/profile/settings');
    revalidatePath('/seller/settings');
    revalidatePath('/');

    return {
      success: true,
      avatarUrl: uploadResult.avatarUrl,
      error: null,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to upload avatar';
    return {
      success: false,
      avatarUrl: null,
      error: message,
    };
  }
}

export async function removeAvatarAction(userId: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        success: false,
        avatarUrl: null,
        error: 'Session expired. Please log in again.',
      };
    }

    if (user.id !== userId) {
      return {
        success: false,
        avatarUrl: null,
        error: 'Unauthorized avatar removal request.',
      };
    }

    const removeResult = await handleAvatarRemove(userId);
    if (!removeResult.success) {
      return {
        success: false,
        avatarUrl: null,
        error: removeResult.error,
      };
    }

    revalidatePath('/profile/settings');
    revalidatePath('/seller/settings');
    revalidatePath('/');

    return {
      success: true,
      avatarUrl: null,
      error: null,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to remove avatar';
    return {
      success: false,
      avatarUrl: null,
      error: message,
    };
  }
}
