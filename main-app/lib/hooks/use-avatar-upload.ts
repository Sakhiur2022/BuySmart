'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { removeAvatarAction, uploadAvatarAction } from '@/lib/actions/settings';
import { validateAvatarFile } from '@/lib/types/avatar.types';

type UseAvatarUploadOptions = {
  userId: string;
  initialAvatarUrl: string | null;
};

type UseAvatarUploadResult = {
  avatarUrl: string | null;
  selectedFile: File | null;
  previewUrl: string | null;
  uploading: boolean;
  removing: boolean;
  progress: number;
  error: string | null;
  success: string | null;
  onFileSelect: (file: File | null) => void;
  uploadAvatar: () => Promise<boolean>;
  removeAvatar: () => Promise<boolean>;
  clearMessage: () => void;
};

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

  return normalizedPath || null;
}

export function useAvatarUpload({
  userId,
  initialAvatarUrl,
}: UseAvatarUploadOptions): UseAvatarUploadResult {
  const router = useRouter();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setAvatarUrl(initialAvatarUrl);
  }, [initialAvatarUrl]);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  const onFileSelect = useCallback((file: File | null) => {
    setError(null);
    setSuccess(null);

    if (!file) {
      setSelectedFile(null);
      return;
    }

    const validation = validateAvatarFile(file);
    if (!validation.valid) {
      setSelectedFile(null);
      setError(validation.error);
      return;
    }

    setSelectedFile(file);
  }, []);

  const uploadAvatar = useCallback(async (): Promise<boolean> => {
    if (!selectedFile) {
      setError('Please choose an image file before uploading.');
      return false;
    }

    const validation = validateAvatarFile(selectedFile);
    if (!validation.valid) {
      setError(validation.error);
      return false;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);
    setProgress(20);

    const formData = new FormData();
    formData.append('userId', userId);
    formData.append('avatarFile', selectedFile);

    const previousStoragePath = parseStoragePathFromAvatarUrl(avatarUrl);
    if (previousStoragePath) {
      formData.append('previousStoragePath', previousStoragePath);
    }

    setProgress(55);
    const result = await uploadAvatarAction(formData);
    setProgress(100);
    setUploading(false);

    if (!result.success || !result.avatarUrl) {
      setError(result.error ?? 'Upload failed. Please try again.');
      setProgress(0);
      return false;
    }

    setAvatarUrl(result.avatarUrl);
    setSelectedFile(null);
    setSuccess('Avatar updated successfully.');
    router.refresh();
    setTimeout(() => setProgress(0), 400);
    return true;
  }, [avatarUrl, router, selectedFile, userId]);

  const removeAvatar = useCallback(async (): Promise<boolean> => {
    setRemoving(true);
    setError(null);
    setSuccess(null);

    const result = await removeAvatarAction(userId);
    setRemoving(false);

    if (!result.success) {
      setError(result.error ?? 'Could not remove avatar. Please try again.');
      return false;
    }

    setAvatarUrl(null);
    setSelectedFile(null);
    setPreviewUrl(null);
    setProgress(0);
    setSuccess('Avatar removed successfully.');
    router.refresh();
    return true;
  }, [router, userId]);

  const clearMessage = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []);

  const effectivePreview = useMemo(() => previewUrl || avatarUrl, [avatarUrl, previewUrl]);

  return {
    avatarUrl,
    selectedFile,
    previewUrl: effectivePreview,
    uploading,
    removing,
    progress,
    error,
    success,
    onFileSelect,
    uploadAvatar,
    removeAvatar,
    clearMessage,
  };
}
