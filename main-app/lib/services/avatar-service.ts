import {
  deleteAvatarFromStorage,
  getCurrentAvatarMetadata,
  updateUserAvatarUrl,
  uploadAvatarToStorage,
} from '@/lib/repositories/avatar';
import {
  AvatarRemoveResult,
  AvatarUploadInput,
  AvatarUploadResult,
  validateAvatarFile,
} from '@/lib/types/avatar.types';

function parseStoragePathFromAvatarUrl(avatarUrl: string | null): string | null {
  if (!avatarUrl) {
    return null;
  }

  const marker = '/storage/v1/object/public/avatars/';
  const markerIndex = avatarUrl.indexOf(marker);

  if (markerIndex === -1) {
    return null;
  }

  const rawPath = avatarUrl.slice(markerIndex + marker.length);
  const normalizedPath = rawPath.split('?')[0]?.trim() ?? '';

  if (!normalizedPath) {
    return null;
  }

  return normalizedPath;
}

export async function handleAvatarUpload(input: AvatarUploadInput): Promise<AvatarUploadResult> {
  const validation = validateAvatarFile(input.file);
  if (!validation.valid) {
    return {
      success: false,
      avatarUrl: null,
      storagePath: null,
      error: validation.error,
    };
  }

  const currentMetadata = await getCurrentAvatarMetadata();
  const currentStoragePath = currentMetadata.success
    ? parseStoragePathFromAvatarUrl(currentMetadata.avatarUrl)
    : null;
  const fallbackStoragePath = input.previousStoragePath ?? null;
  const oldStoragePath = currentStoragePath ?? fallbackStoragePath;

  const uploadResult = await uploadAvatarToStorage(input);
  if (!uploadResult.success || !uploadResult.avatarUrl || !uploadResult.storagePath) {
    return uploadResult;
  }

  const metadataResult = await updateUserAvatarUrl(input.userId, uploadResult.avatarUrl);
  if (!metadataResult.success) {
    await deleteAvatarFromStorage(input.userId, uploadResult.storagePath);
    return {
      success: false,
      avatarUrl: null,
      storagePath: null,
      error: metadataResult.error || 'Failed to sync avatar metadata.',
    };
  }

  if (oldStoragePath && oldStoragePath !== uploadResult.storagePath) {
    await deleteAvatarFromStorage(input.userId, oldStoragePath);
  }

  return uploadResult;
}

export async function handleAvatarRemove(userId: string): Promise<AvatarRemoveResult> {
  const currentMetadata = await getCurrentAvatarMetadata();
  if (!currentMetadata.success) {
    return {
      success: false,
      avatarUrl: null,
      error: currentMetadata.error || 'Failed to load current avatar.',
    };
  }

  const metadataResult = await updateUserAvatarUrl(userId, null);
  if (!metadataResult.success) {
    return {
      success: false,
      avatarUrl: null,
      error: metadataResult.error || 'Failed to remove avatar.',
    };
  }

  const storagePath = parseStoragePathFromAvatarUrl(currentMetadata.avatarUrl);
  if (storagePath) {
    await deleteAvatarFromStorage(userId, storagePath);
  }

  return {
    success: true,
    avatarUrl: null,
    error: null,
  };
}
