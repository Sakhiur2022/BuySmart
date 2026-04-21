import type { SupabaseClient } from '@supabase/supabase-js';
import { PRODUCT_IMAGE_BUCKET, PRODUCT_IMAGE_STORAGE_ROOT } from '@/lib/supabase/storage-config';
import type { Database } from '@/lib/types/database.types';

export type ProductImageUploadResult = {
  success: boolean;
  publicUrl: string | null;
  storagePath: string | null;
  error: string | null;
};

export type ProductImageDeleteResult = {
  success: boolean;
  error: string | null;
};

export interface ProductImageStorageRepository {
  uploadImage(input: {
    sellerId: string;
    productId: string;
    file: File;
  }): Promise<ProductImageUploadResult>;
  deleteImage(input: { sellerId: string; storagePath: string }): Promise<ProductImageDeleteResult>;
  deleteImageByPublicUrl(input: {
    sellerId: string;
    publicUrl: string;
  }): Promise<ProductImageDeleteResult>;
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase();
}

function buildStoragePath(sellerId: string, productId: string, fileName: string): string {
  const safeName = sanitizeFileName(fileName);
  return `${PRODUCT_IMAGE_STORAGE_ROOT}/${sellerId}/${productId}/${Date.now()}-${safeName}`;
}

function parseStoragePathFromPublicUrl(publicUrl: string): string | null {
  const marker = `/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/`;
  const markerIndex = publicUrl.indexOf(marker);

  if (markerIndex === -1) {
    return null;
  }

  const rawPath = publicUrl.slice(markerIndex + marker.length);
  const normalizedPath = rawPath.split('?')[0]?.trim() ?? '';

  return normalizedPath || null;
}

export class SupabaseProductImageRepository implements ProductImageStorageRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async uploadImage(input: {
    sellerId: string;
    productId: string;
    file: File;
  }): Promise<ProductImageUploadResult> {
    const storagePath = buildStoragePath(input.sellerId, input.productId, input.file.name);
    const bytes = await input.file.arrayBuffer();

    const { error: uploadError } = await this.supabase.storage
      .from(PRODUCT_IMAGE_BUCKET)
      .upload(storagePath, bytes, {
        contentType: input.file.type,
        upsert: false,
      });

    if (uploadError) {
      return {
        success: false,
        publicUrl: null,
        storagePath: null,
        error: uploadError.message || 'Failed to upload product image.',
      };
    }

    const { data } = this.supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(storagePath);

    return {
      success: true,
      publicUrl: data.publicUrl,
      storagePath,
      error: null,
    };
  }

  async deleteImage(input: {
    sellerId: string;
    storagePath: string;
  }): Promise<ProductImageDeleteResult> {
    const expectedPrefix = `${PRODUCT_IMAGE_STORAGE_ROOT}/${input.sellerId}/`;

    if (!input.storagePath.startsWith(expectedPrefix)) {
      return {
        success: false,
        error: 'Invalid product image path.',
      };
    }

    const { error } = await this.supabase.storage
      .from(PRODUCT_IMAGE_BUCKET)
      .remove([input.storagePath]);

    if (error) {
      return {
        success: false,
        error: error.message || 'Failed to remove product image.',
      };
    }

    return {
      success: true,
      error: null,
    };
  }

  async deleteImageByPublicUrl(input: {
    sellerId: string;
    publicUrl: string;
  }): Promise<ProductImageDeleteResult> {
    const storagePath = parseStoragePathFromPublicUrl(input.publicUrl);

    if (!storagePath) {
      return {
        success: false,
        error: 'Invalid product image url.',
      };
    }

    return this.deleteImage({
      sellerId: input.sellerId,
      storagePath,
    });
  }
}
