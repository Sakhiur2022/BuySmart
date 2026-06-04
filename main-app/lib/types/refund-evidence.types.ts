export const REFUND_EVIDENCE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_REFUND_EVIDENCE_BUCKET?.trim() || 'refund-evidence';

export const REFUND_EVIDENCE_ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const REFUND_EVIDENCE_MAX_BYTES = 5 * 1024 * 1024;
export const REFUND_EVIDENCE_MAX_FILES = 10;

export type RefundEvidenceValidation = {
  valid: boolean;
  reason?: string;
};

export function validateRefundEvidenceFile(file: File): RefundEvidenceValidation {
  if (!REFUND_EVIDENCE_ALLOWED_TYPES.includes(file.type as (typeof REFUND_EVIDENCE_ALLOWED_TYPES)[number])) {
    return { valid: false, reason: 'Unsupported file format.' };
  }

  if (file.size > REFUND_EVIDENCE_MAX_BYTES) {
    const sizeMb = Math.round(REFUND_EVIDENCE_MAX_BYTES / (1024 * 1024));
    return { valid: false, reason: `File exceeds ${sizeMb}MB.` };
  }

  return { valid: true };
}
