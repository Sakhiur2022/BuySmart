'use client';

import { useCallback, useMemo, useState } from 'react';

import {
  REFUND_EVIDENCE_MAX_FILES,
  validateRefundEvidenceFile,
} from '@/lib/types/refund-evidence.types';

export type RefundAttachmentValidation = {
  valid: boolean;
  reason?: string;
};

export type RefundEvidenceAttachmentState = {
  files: File[];
  progress: number;
  validation: RefundAttachmentValidation;
  maxFiles: number;
};

export function useRefundEvidenceAttachment(options?: {
  maxFiles?: number;
}) {
  const maxFiles = options?.maxFiles ?? REFUND_EVIDENCE_MAX_FILES;

  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);
  const [validation, setValidation] = useState<RefundAttachmentValidation>({ valid: true });

  const attach = useCallback(
    (incoming: FileList | File[]) => {
      const incomingFiles = Array.from(incoming);
      const accepted: File[] = [];
      let errorMessage: string | undefined;

      for (const file of incomingFiles) {
        const fileValidation = validateRefundEvidenceFile(file);
        if (!fileValidation.valid) {
          errorMessage = errorMessage ?? fileValidation.reason;
          continue;
        }

        accepted.push(file);
      }

      setFiles((current) => {
        const merged = [...current, ...accepted];
        if (merged.length > maxFiles) {
          errorMessage = errorMessage ?? `You can upload up to ${maxFiles} images.`;
          return merged.slice(0, maxFiles);
        }

        return merged;
      });

      if (errorMessage) {
        setValidation({ valid: false, reason: errorMessage });
      } else {
        setValidation({ valid: true });
      }

      return { valid: !errorMessage, reason: errorMessage };
    },
    [maxFiles],
  );

  const removeAt = useCallback((index: number) => {
    setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
    setProgress(0);
    setValidation({ valid: true });
  }, []);

  const clear = useCallback(() => {
    setFiles([]);
    setProgress(0);
    setValidation({ valid: true });
  }, []);

  const updateProgress = useCallback((nextProgress: number) => {
    setProgress(Math.max(0, Math.min(100, nextProgress)));
  }, []);

  const state: RefundEvidenceAttachmentState = useMemo(
    () => ({ files, progress, validation, maxFiles }),
    [files, progress, validation, maxFiles],
  );

  return {
    ...state,
    attach,
    removeAt,
    clear,
    updateProgress,
  };
}
