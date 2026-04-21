import {
  type ProductImageStorageRepository,
  type ProductImageUploadResult,
} from '@/lib/repositories/product-image.repository';
import {
  MAX_PRODUCT_IMAGE_COUNT,
  type ProductImageOrderRef,
  type ProductImageUploadCandidate,
  type ProductImageUploadRecord,
  validateProductImageFile,
} from '@/lib/types/product-image.types';

type PrepareProductImagesInput = {
  sellerId: string;
  productId: string;
  existingImageUrls: string[];
  imageOrder: ProductImageOrderRef[];
  newImages: ProductImageUploadCandidate[];
};

type PrepareProductImagesResult =
  | {
      success: true;
      finalImageUrls: string[];
      removedImageUrls: string[];
      uploadedImageUrls: string[];
    }
  | {
      success: false;
      error: string;
    };

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function getUploadErrorMessage(result: ProductImageUploadResult): string {
  return result.error || 'Failed to upload one or more product images.';
}

export class ProductImageService {
  constructor(private readonly storageRepository: ProductImageStorageRepository) {}

  async prepareProductImages(
    input: PrepareProductImagesInput,
  ): Promise<PrepareProductImagesResult> {
    if (input.imageOrder.length > MAX_PRODUCT_IMAGE_COUNT) {
      return {
        success: false,
        error: `A product can have at most ${MAX_PRODUCT_IMAGE_COUNT} images.`,
      };
    }

    const existingImageSet = new Set(input.existingImageUrls);
    const newImageByToken = new Map(input.newImages.map((entry) => [entry.token, entry.file]));

    for (const existingRef of input.imageOrder.filter((entry) => entry.kind === 'existing')) {
      if (!existingImageSet.has(existingRef.value)) {
        return {
          success: false,
          error: 'Invalid existing image reference was provided.',
        };
      }
    }

    for (const candidate of input.newImages) {
      const validation = validateProductImageFile(candidate.file);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error || 'Invalid image file.',
        };
      }
    }

    const uploadedRecords: ProductImageUploadRecord[] = [];

    for (const ref of input.imageOrder) {
      if (ref.kind !== 'new') {
        continue;
      }

      const file = newImageByToken.get(ref.value);

      if (!file) {
        await this.deleteUploadedRecords(input.sellerId, uploadedRecords);
        return {
          success: false,
          error: 'A selected new image is missing from the upload payload.',
        };
      }

      const upload = await this.storageRepository.uploadImage({
        sellerId: input.sellerId,
        productId: input.productId,
        file,
      });

      if (!upload.success || !upload.publicUrl || !upload.storagePath) {
        await this.deleteUploadedRecords(input.sellerId, uploadedRecords);
        return {
          success: false,
          error: getUploadErrorMessage(upload),
        };
      }

      uploadedRecords.push({
        token: ref.value,
        publicUrl: upload.publicUrl,
        storagePath: upload.storagePath,
      });
    }

    const uploadedByToken = new Map(uploadedRecords.map((entry) => [entry.token, entry.publicUrl]));
    const finalImageUrls: string[] = [];

    for (const ref of input.imageOrder) {
      if (ref.kind === 'existing') {
        finalImageUrls.push(ref.value);
      } else {
        const uploadedUrl = uploadedByToken.get(ref.value);

        if (!uploadedUrl) {
          await this.deleteUploadedRecords(input.sellerId, uploadedRecords);
          return {
            success: false,
            error: 'Failed to finalize product image ordering.',
          };
        }

        finalImageUrls.push(uploadedUrl);
      }
    }

    const normalizedFinalImageUrls = dedupeStrings(finalImageUrls);

    if (normalizedFinalImageUrls.length > MAX_PRODUCT_IMAGE_COUNT) {
      await this.deleteUploadedRecords(input.sellerId, uploadedRecords);
      return {
        success: false,
        error: `A product can have at most ${MAX_PRODUCT_IMAGE_COUNT} images.`,
      };
    }

    const removedImageUrls = input.existingImageUrls.filter(
      (url) => !normalizedFinalImageUrls.includes(url),
    );

    return {
      success: true,
      finalImageUrls: normalizedFinalImageUrls,
      removedImageUrls,
      uploadedImageUrls: uploadedRecords.map((entry) => entry.publicUrl),
    };
  }

  async deleteImagesByUrl(sellerId: string, urls: string[]): Promise<void> {
    for (const url of dedupeStrings(urls)) {
      await this.storageRepository.deleteImageByPublicUrl({
        sellerId,
        publicUrl: url,
      });
    }
  }

  private async deleteUploadedRecords(
    sellerId: string,
    uploadedRecords: ProductImageUploadRecord[],
  ): Promise<void> {
    for (const record of uploadedRecords) {
      await this.storageRepository.deleteImage({
        sellerId,
        storagePath: record.storagePath,
      });
    }
  }
}
