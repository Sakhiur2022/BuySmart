'use client';

import Image from 'next/image';
import { useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, Check, AlertCircle } from 'lucide-react';
import { useAvatarUpload } from '@/lib/hooks/use-avatar-upload';
import { ACCEPTED_AVATAR_MIME_TYPES } from '@/lib/types/avatar.types';
import { cn } from '@/lib/utils';

type AvatarUploadWidgetProps = {
  userId: string;
  initialAvatarUrl?: string | null;
  displayName?: string | null;
  className?: string;
  onUploadSuccess?: (url: string) => void;
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
  className,
  onUploadSuccess,
}: AvatarUploadWidgetProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    avatarUrl,
    selectedFile,
    previewUrl,
    uploading,
    progress,
    error,
    success,
    onFileSelect,
    uploadAvatar,
    clearMessage,
  } = useAvatarUpload({
    userId,
    initialAvatarUrl,
  });

  const initials = getInitials(displayName);
  const effectiveAvatarUrl =
    previewUrl || (typeof avatarUrl === 'string' && avatarUrl.trim() ? avatarUrl : null);

  // Auto-upload when a file is selected
  useEffect(() => {
    if (selectedFile && !uploading) {
      void uploadAvatar().then((ok) => {
        if (ok && avatarUrl && onUploadSuccess) {
          onUploadSuccess(avatarUrl);
        }
      });
    }
  }, [selectedFile, uploading, uploadAvatar, avatarUrl, onUploadSuccess]);

  // Dismiss messages after a delay
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        clearMessage();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [success, error, clearMessage]);

  const handleCameraClick = () => {
    if (uploading) return;
    clearMessage();
    fileInputRef.current?.click();
  };

  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center auto-cols-min flex-col',
        className,
      )}
    >
      <motion.div
        className="relative group cursor-pointer"
        onClick={handleCameraClick}
        animate={error ? { x: [0, -6, 6, -6, 6, -3, 3, 0] } : undefined}
        transition={error ? { duration: 0.4 } : undefined}
      >
        <div className="relative h-16 w-16 sm:h-20 sm:w-20 rounded-full border-2 border-pink-200 dark:border-pink-500/40 shadow-sm bg-muted overflow-hidden">
          <AnimatePresence mode="wait">
            {effectiveAvatarUrl ? (
              <motion.div
                key={effectiveAvatarUrl}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0"
              >
                <Image
                  src={effectiveAvatarUrl}
                  alt="Profile avatar"
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 64px, 80px"
                  unoptimized={effectiveAvatarUrl.startsWith('blob:')}
                />
              </motion.div>
            ) : (
              <motion.div
                key="fallback"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 flex items-center justify-center text-lg font-medium uppercase text-muted-foreground"
              >
                {initials}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Uploading overlay */}
          <AnimatePresence>
            {uploading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[1px]"
              >
                {/* SVG Progress Ring */}
                <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
                  <circle
                    className="text-white/20"
                    strokeWidth="3"
                    stroke="currentColor"
                    fill="transparent"
                    r="16"
                    cx="20"
                    cy="20"
                  />
                  <motion.circle
                    className="text-pink-500"
                    strokeWidth="3"
                    strokeDasharray="100"
                    strokeDashoffset="100"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r="16"
                    cx="20"
                    cy="20"
                    initial={{ strokeDashoffset: 100 }}
                    animate={{ strokeDashoffset: 100 - progress }}
                    transition={{ type: 'tween', ease: 'linear', duration: 0.2 }}
                  />
                </svg>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Camera Icon Overlay */}
        <AnimatePresence mode="wait">
          {success ? (
            <motion.div
              key="success"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="absolute bottom-0 right-0 rounded-full bg-emerald-500 p-1.5 sm:p-2 text-white shadow-lg ring-2 ring-white dark:ring-background"
            >
              <Check className="h-3 w-3 sm:h-4 sm:w-4" />
            </motion.div>
          ) : (
            <motion.div
              key="camera"
              initial={{ scale: 1 }}
              whileHover={
                !uploading && !error
                  ? { scale: 1.15, boxShadow: '0px 0px 8px rgba(244,114,182,0.6)' }
                  : undefined
              }
              whileTap={!uploading && !error ? { scale: 0.95 } : undefined}
              className={cn(
                'absolute bottom-0 right-0 rounded-full p-1.5 sm:p-2 text-white shadow-lg ring-2 ring-white dark:ring-background transition-colors',
                error
                  ? 'bg-red-500'
                  : 'bg-rose-500 hover:bg-rose-600 dark:bg-rose-600 dark:hover:bg-rose-500',
              )}
            >
              {error ? (
                <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4" />
              ) : (
                <Camera className="h-3 w-3 sm:h-4 sm:w-4" />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_AVATAR_MIME_TYPES.join(',')}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          onFileSelect(file);
          event.currentTarget.value = '';
        }}
      />

      {/* Optional short error text */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="absolute top-[calc(100%+8px)] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-red-100 dark:bg-red-900/40 px-2 py-1 text-[11px] font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 z-10"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
