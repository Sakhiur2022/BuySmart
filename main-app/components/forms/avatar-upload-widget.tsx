'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ImagePlus, Loader2, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useAvatarUpload } from '@/lib/hooks/use-avatar-upload';
import { ACCEPTED_AVATAR_MIME_TYPES, MAX_AVATAR_SIZE_BYTES } from '@/lib/types/avatar.types';

type AvatarUploadWidgetProps = {
  userId: string;
  initialAvatarUrl?: string | null;
  displayName?: string | null;
  disabled?: boolean;
};

function getInitials(name: string | null | undefined): string {
  if (!name || !name.trim()) {
    return 'U';
  }

  const parts = name.trim().split(/\s+/).slice(0, 2);
  const initials = parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
  return initials || 'U';
}

export function AvatarUploadWidget({
  userId,
  initialAvatarUrl = null,
  displayName = null,
  disabled = false,
}: AvatarUploadWidgetProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const {
    avatarUrl,
    selectedFile,
    uploading,
    removing,
    progress,
    error,
    success,
    onFileSelect,
    uploadAvatar,
    removeAvatar,
    clearMessage,
  } = useAvatarUpload({
    userId,
    initialAvatarUrl,
  });

  const initials = getInitials(displayName);
  const sizeInMb = Math.floor(MAX_AVATAR_SIZE_BYTES / (1024 * 1024));
  const effectiveAvatarUrl = typeof avatarUrl === 'string' && avatarUrl.trim() ? avatarUrl : null;

  return (
    <div className="space-y-4 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Profile picture</h3>
          <p className="text-xs text-muted-foreground">JPG, PNG, or WEBP up to {sizeInMb}MB.</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative h-20 w-20 overflow-hidden rounded-full bg-muted">
          {effectiveAvatarUrl ? (
            <Image
              src={effectiveAvatarUrl}
              alt="Profile avatar"
              fill
              className="object-cover"
              sizes="80px"
              unoptimized={effectiveAvatarUrl.startsWith('blob:')}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-lg font-medium uppercase">
              {initials}
            </div>
          )}
        </div>

        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={disabled || uploading || removing}
              onClick={() => {
                clearMessage();
                fileInputRef.current?.click();
              }}
            >
              <ImagePlus className="mr-2 h-4 w-4" />
              Choose image
            </Button>

            <Button
              type="button"
              disabled={disabled || uploading || removing || !selectedFile}
              onClick={() => {
                void uploadAvatar();
              }}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="destructive"
              disabled={disabled || uploading || removing || !avatarUrl}
              onClick={() => {
                clearMessage();
                setConfirmRemoveOpen(true);
              }}
            >
              {removing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove
                </>
              )}
            </Button>
          </div>

          <div className="space-y-1">
            <Label htmlFor={`avatar-file-${userId}`} className="text-xs text-muted-foreground">
              Accepted: {ACCEPTED_AVATAR_MIME_TYPES.join(', ')}
            </Label>
            <input
              ref={fileInputRef}
              id={`avatar-file-${userId}`}
              type="file"
              accept={ACCEPTED_AVATAR_MIME_TYPES.join(',')}
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                onFileSelect(file);
                event.currentTarget.value = '';
              }}
            />
          </div>

          {uploading && progress > 0 ? (
            <div className="space-y-1">
              <div className="h-2 w-full overflow-hidden rounded bg-muted">
                <motion.div
                  className="h-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                />
              </div>
              <p className="text-xs text-muted-foreground">Upload progress: {progress}%</p>
            </div>
          ) : null}

          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          ) : null}

          {success ? (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              {success}
            </p>
          ) : null}
        </div>
      </div>

      <Dialog open={confirmRemoveOpen} onOpenChange={setConfirmRemoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove avatar?</DialogTitle>
            <DialogDescription>
              This removes your profile picture and restores your default avatar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRemoveOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={removing}
              onClick={() => {
                void removeAvatar().then((ok) => {
                  if (ok) {
                    setConfirmRemoveOpen(false);
                  }
                });
              }}
            >
              {removing ? 'Removing...' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
