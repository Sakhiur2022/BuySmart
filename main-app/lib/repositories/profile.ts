import { createClient } from '@/lib/supabase/server';

export type UpdateProfileInput = {
  userId: string;
  avatar_url?: string | null;
  display_name?: string;
  bio?: string;
};

export type ProfileUpdateResult = {
  success: boolean;
  error: string | null;
};

/**
 * Updates the user's profile in the users_profile table.
 * Respects RLS policies - only authenticated users can update their own profile.
 */
export async function updateUserProfile(input: UpdateProfileInput): Promise<ProfileUpdateResult> {
  const { userId, ...updateData } = input;

  // Remove undefined fields to avoid overwriting existing values
  const cleanedData = Object.fromEntries(
    Object.entries(updateData).filter(([, value]) => value !== undefined),
  );

  if (Object.keys(cleanedData).length === 0) {
    return {
      success: true,
      error: null,
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.from('users_profile').update(cleanedData).eq('user_id', userId);

  if (error) {
    console.error('[ProfileRepository] Update error:', error);
    return {
      success: false,
      error: error.message || 'Failed to update profile.',
    };
  }

  return {
    success: true,
    error: null,
  };
}

/**
 * Gets the user's profile data.
 */
export async function getUserProfile(userId: string): Promise<{
  success: boolean;
  data: unknown | null;
  error: string | null;
}> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('users_profile')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('[ProfileRepository] Fetch error:', error);
    return {
      success: false,
      data: null,
      error: error.message || 'Failed to fetch profile.',
    };
  }

  return {
    success: true,
    data,
    error: null,
  };
}
