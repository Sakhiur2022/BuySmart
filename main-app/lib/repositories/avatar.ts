import { createClient } from '@/lib/supabase/server';
import { updateUserProfile } from '@/lib/repositories/profile';
import {
  ACCEPTED_AVATAR_MIME_TYPES,
  AVATAR_BUCKET,
  AvatarUploadInput,
  AvatarUploadResult,
  MAX_AVATAR_SIZE_BYTES,
} from '@/lib/types/avatar.types';

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase();
}

function buildStoragePath(userId: string, fileName: string): string {
  const safeName = sanitizeFileName(fileName);
  return `${userId}/${Date.now()}-${safeName}`;
}

export async function uploadAvatarToStorage(input: AvatarUploadInput): Promise<AvatarUploadResult> {
  const { userId, file } = input;

  if (
    !ACCEPTED_AVATAR_MIME_TYPES.includes(file.type as (typeof ACCEPTED_AVATAR_MIME_TYPES)[number])
  ) {
    return {
      success: false,
      avatarUrl: null,
      storagePath: null,
      error: 'Invalid file type. Please upload a JPG, PNG, or WEBP image.',
    };
  }

  if (file.size > MAX_AVATAR_SIZE_BYTES) {
    return {
      success: false,
      avatarUrl: null,
      storagePath: null,
      error: 'File is too large. Please upload an image under 2MB.',
    };
  }

  const supabase = await createClient();
  const storagePath = buildStoragePath(userId, file.name);
  const bytes = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(storagePath, bytes, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return {
      success: false,
      avatarUrl: null,
      storagePath: null,
      error: uploadError.message || 'Failed to upload avatar.',
    };
  }

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(storagePath);

  return {
    success: true,
    avatarUrl: data.publicUrl,
    storagePath,
    error: null,
  };
}

export async function deleteAvatarFromStorage(
  userId: string,
  storagePath: string,
): Promise<{ success: boolean; error: string | null }> {
  if (!storagePath || !storagePath.startsWith(`${userId}/`)) {
    return {
      success: false,
      error: 'Invalid avatar path.',
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([storagePath]);

  if (error) {
    return {
      success: false,
      error: error.message || 'Failed to remove avatar file.',
    };
  }

  return {
    success: true,
    error: null,
  };
}

export async function updateUserAvatarUrl(
  userId: string,
  avatarUrl: string | null,
): Promise<{ success: boolean; error: string | null }> {
  const result = await updateUserProfile({
    userId,
    avatar_url: avatarUrl,
  });

  return result;
}

export async function getCurrentAvatarMetadata(): Promise<{
  success: boolean;
  avatarUrl: string | null;
  error: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      avatarUrl: null,
      error: userError?.message || 'User session not found.',
    };
  }

  // Fetch the avatar URL from the users_profile table
  const { data, error } = await supabase
    .from('users_profile')
    .select('avatar_url')
    .eq('user_id', user.id)
    .single();

  if (error) {
    // If profile doesn't exist yet, return null (not an error)
    if (error.code === 'PGRST116') {
      return {
        success: true,
        avatarUrl: null,
        error: null,
      };
    }

    return {
      success: false,
      avatarUrl: null,
      error: error.message || 'Failed to fetch avatar metadata.',
    };
  }

  return {
    success: true,
    avatarUrl: (data?.avatar_url as string) || null,
    error: null,
  };
}
