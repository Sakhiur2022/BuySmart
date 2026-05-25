'use client';

import { useCallback, useMemo, useState } from 'react';

export type RefundAttachmentValidation = {
  valid: boolean;
  reason?: string;
};

export type RefundEvidenceAttachmentState = {
  file: File | null;
  progress: number;
  validation: RefundAttachmentValidation;
};

const DEFAULT_MAX_SIZE_MB = 5;
const DEFAULT_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function validateFile(
  file: File,
  maxSizeMb: number,
  allowedTypes: string[],
): RefundAttachmentValidation {
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, reason: 'Unsupported file format.' };
  }

  const maxBytes = maxSizeMb * 1024 * 1024;
  if (file.size > maxBytes) {
    return { valid: false, reason: `File exceeds ${maxSizeMb}MB.` };
  }

  return { valid: true };
}

export function useRefundEvidenceAttachment(options?: {
  maxSizeMb?: number;
  allowedTypes?: string[];
}) {
  const maxSizeMb = options?.maxSizeMb ?? DEFAULT_MAX_SIZE_MB;
  const allowedTypes = options?.allowedTypes ?? DEFAULT_ALLOWED_TYPES;

  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [validation, setValidation] = useState<RefundAttachmentValidation>({ valid: true });

  const attach = useCallback(
    (nextFile: File) => {
      const nextValidation = validateFile(nextFile, maxSizeMb, allowedTypes);
      setValidation(nextValidation);

      if (!nextValidation.valid) {
        setFile(null);
        setProgress(0);
        return nextValidation;
      }

      setFile(nextFile);
      setProgress(0);
      return nextValidation;
    },
    [maxSizeMb, allowedTypes],
  );

  const remove = useCallback(() => {
    setFile(null);
    setProgress(0);
    setValidation({ valid: true });
  }, []);

  const updateProgress = useCallback((nextProgress: number) => {
    setProgress(Math.max(0, Math.min(100, nextProgress)));
  }, []);

  const state: RefundEvidenceAttachmentState = useMemo(
    () => ({ file, progress, validation }),
    [file, progress, validation],
  );

  return {
    ...state,
    attach,
    remove,
    updateProgress,
  };
}
