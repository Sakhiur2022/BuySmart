import { z } from 'zod';

export const MAX_PRODUCT_IMAGE_COUNT = 5;
export const MAX_PRODUCT_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_PRODUCT_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type AcceptedProductImageMimeType = (typeof ACCEPTED_PRODUCT_IMAGE_MIME_TYPES)[number];

export type ProductImageOrderRef =
  | { kind: 'existing'; value: string }
  | { kind: 'new'; value: string };

export type ProductImageValidationResult = {
  valid: boolean;
  error: string | null;
};

export type ProductImageUploadCandidate = {
  token: string;
  file: File;
};

export type ProductImageUploadRecord = {
  token: string;
  publicUrl: string;
  storagePath: string;
};

export const productImageOrderRefSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('existing'),
    value: z.string().url(),
  }),
  z.object({
    kind: z.literal('new'),
    value: z.string().min(1),
  }),
]);

export const productImageOrderSchema = z
  .array(productImageOrderRefSchema)
  .max(MAX_PRODUCT_IMAGE_COUNT);

const productImageMimeSchema = z.enum(ACCEPTED_PRODUCT_IMAGE_MIME_TYPES);

export const productImagePayloadSchema = z.object({
  imageOrder: productImageOrderSchema,
  newImageTokens: z.array(z.string().min(1)).max(MAX_PRODUCT_IMAGE_COUNT),
});

export function validateProductImageFile(
  file: File | null | undefined,
): ProductImageValidationResult {
  if (!file) {
    return {
      valid: false,
      error: 'Please choose an image before uploading.',
    };
  }

  const mimeResult = productImageMimeSchema.safeParse(file.type);

  if (!mimeResult.success) {
    return {
      valid: false,
      error: 'Invalid file type. Please upload JPG, PNG, or WEBP images only.',
    };
  }

  if (file.size > MAX_PRODUCT_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      error: 'File is too large. Each image must be 5MB or smaller.',
    };
  }

  return {
    valid: true,
    error: null,
  };
}
