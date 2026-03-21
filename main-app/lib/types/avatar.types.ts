export const AVATAR_BUCKET = 'avatars';
export const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024;
export const ACCEPTED_AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type AcceptedAvatarMimeType = (typeof ACCEPTED_AVATAR_MIME_TYPES)[number];

export type AvatarUploadInput = {
  userId: string;
  file: File;
  previousStoragePath?: string | null;
};

export type AvatarUploadResult = {
  success: boolean;
  avatarUrl: string | null;
  storagePath: string | null;
  error: string | null;
};

export type AvatarRemoveResult = {
  success: boolean;
  avatarUrl: null;
  error: string | null;
};

export type AvatarValidationResult = {
  valid: boolean;
  error: string | null;
};

export function validateAvatarFile(file: File | null | undefined): AvatarValidationResult {
  if (!file) {
    return {
      valid: false,
      error: 'Please choose an image file before uploading.',
    };
  }

  if (!ACCEPTED_AVATAR_MIME_TYPES.includes(file.type as AcceptedAvatarMimeType)) {
    return {
      valid: false,
      error: 'Invalid file type. Please upload a JPG, PNG, or WEBP image.',
    };
  }

  if (file.size > MAX_AVATAR_SIZE_BYTES) {
    return {
      valid: false,
      error: 'File is too large. Please upload an image under 2MB.',
    };
  }

  return {
    valid: true,
    error: null,
  };
}
