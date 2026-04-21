'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { SupabaseProductImageRepository } from '@/lib/repositories/product-image.repository';
import { ProductImageService } from '@/lib/services/product-image.service';
import { createClient } from '@/lib/supabase/server';
import { getServiceRoleSupabase } from '@/lib/supabase/service-role';
import {
  type ProductImageOrderRef,
  productImagePayloadSchema,
} from '@/lib/types/product-image.types';

type ProductStatus = 'draft' | 'active' | 'inactive' | 'out_of_stock' | 'archived';

const ALLOWED_STATUSES: ProductStatus[] = ['draft', 'active', 'inactive', 'out_of_stock'];
const createOrUpdateProductSchema = z.object({
  name: z.string().min(1).max(255),
  price: z.number().nonnegative(),
  inventoryQuantity: z.number().int().nonnegative(),
  status: z.enum(['draft', 'active', 'inactive', 'out_of_stock']),
  shortDescription: z.string().max(500).nullable(),
  description: z.string().max(4000).nullable(),
  categoryId: z.number().int().positive().nullable(),
});

function getString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function getFiles(formData: FormData, key: string): File[] {
  return formData
    .getAll(key)
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
}

function getNumber(formData: FormData, key: string): number {
  const value = formData.get(key);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function getOptionalCategoryId(formData: FormData, key: string): number | null {
  const value = formData.get(key);

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return NaN;
  }

  return parsed;
}

function getImageList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function parseImagePayload(formData: FormData):
  | {
      success: true;
      imageOrder: ProductImageOrderRef[];
      newImageFiles: File[];
      newImageTokens: string[];
    }
  | { success: false; error: string } {
  const imageOrderRaw = getString(formData, 'image_order');
  const newImageFiles = getFiles(formData, 'new_images');
  const newImageTokens = formData
    .getAll('new_image_tokens')
    .filter((entry): entry is string => typeof entry === 'string')
    .map((token) => token.trim())
    .filter(Boolean);

  let parsedOrder: unknown = [];

  if (imageOrderRaw) {
    try {
      parsedOrder = JSON.parse(imageOrderRaw);
    } catch {
      return {
        success: false,
        error: 'Invalid image order payload.',
      };
    }
  }

  const parsedPayload = productImagePayloadSchema.safeParse({
    imageOrder: parsedOrder,
    newImageTokens,
  });

  if (!parsedPayload.success) {
    return {
      success: false,
      error: parsedPayload.error.issues[0]?.message ?? 'Invalid product image payload.',
    };
  }

  if (newImageTokens.length !== newImageFiles.length) {
    return {
      success: false,
      error: 'Invalid image upload payload.',
    };
  }

  const orderedNewRefs = parsedPayload.data.imageOrder
    .filter(
      (entry): entry is Extract<ProductImageOrderRef, { kind: 'new' }> => entry.kind === 'new',
    )
    .map((entry) => entry.value);
  const uniqueOrderedRefs = new Set(orderedNewRefs);
  const uniqueTokens = new Set(parsedPayload.data.newImageTokens);

  if (uniqueOrderedRefs.size !== uniqueTokens.size) {
    return {
      success: false,
      error: 'Image order references do not match selected uploads.',
    };
  }

  for (const token of uniqueTokens) {
    if (!uniqueOrderedRefs.has(token)) {
      return {
        success: false,
        error: 'Image order references do not match selected uploads.',
      };
    }
  }

  return {
    success: true,
    imageOrder: parsedPayload.data.imageOrder,
    newImageFiles,
    newImageTokens: parsedPayload.data.newImageTokens,
  };
}

function parseProductPayload(
  formData: FormData,
):
  | { success: true; data: z.infer<typeof createOrUpdateProductSchema> }
  | { success: false; error: string } {
  const parsed = createOrUpdateProductSchema.safeParse({
    name: getString(formData, 'name'),
    price: getNumber(formData, 'price'),
    inventoryQuantity: Math.trunc(getNumber(formData, 'inventory_quantity')),
    categoryId: getOptionalCategoryId(formData, 'category_id'),
    status: parseStatus(getString(formData, 'status'), 'active'),
    shortDescription: getString(formData, 'short_description') || null,
    description: getString(formData, 'description') || null,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid product input.',
    };
  }

  return {
    success: true,
    data: parsed.data,
  };
}

function appendQueryParam(basePath: string, key: string, value: string): string {
  const separator = basePath.includes('?') ? '&' : '?';
  return `${basePath}${separator}${key}=${encodeURIComponent(value)}`;
}

function buildErrorPath(basePath: string, message: string): never {
  redirect(appendQueryParam(basePath, 'error', message));
}

async function requireSeller() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const { data: profile } = await supabase
    .from('users_profile')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profile?.role !== 'seller') {
    redirect('/buyer');
  }

  return { supabase, userId: user.id };
}

function parseStatus(value: string, fallback: ProductStatus): ProductStatus {
  if (ALLOWED_STATUSES.includes(value as ProductStatus)) {
    return value as ProductStatus;
  }

  return fallback;
}

export async function createProductAction(formData: FormData) {
  const { supabase, userId } = await requireSeller();
  const serviceRoleClient = getServiceRoleSupabase();
  const writeClient = serviceRoleClient ?? supabase;
  const productImageRepository = new SupabaseProductImageRepository(writeClient);
  const productImageService = new ProductImageService(productImageRepository);

  const parsedProductPayload = parseProductPayload(formData);
  if (!parsedProductPayload.success) {
    buildErrorPath('/seller/products/new', parsedProductPayload.error);
  }

  const parsedImagePayload = parseImagePayload(formData);
  if (!parsedImagePayload.success) {
    buildErrorPath('/seller/products/new', parsedImagePayload.error);
  }

  const newImages = parsedImagePayload.newImageFiles.map((file, index) => ({
    token: parsedImagePayload.newImageTokens[index],
    file,
  }));

  const { data: createdProduct, error: insertError } = await writeClient
    .from('products')
    .insert({
      seller_id: userId,
      category_id: parsedProductPayload.data.categoryId,
      name: parsedProductPayload.data.name,
      price: parsedProductPayload.data.price,
      inventory_quantity: parsedProductPayload.data.inventoryQuantity,
      status: parsedProductPayload.data.status,
      short_description: parsedProductPayload.data.shortDescription,
      description: parsedProductPayload.data.description,
      images: null,
      inventory_tracked: true,
    })
    .select('product_id')
    .single();

  if (insertError || !createdProduct) {
    if (!serviceRoleClient && /row-level security/i.test(insertError?.message || '')) {
      buildErrorPath(
        '/seller/products/new',
        'Product creation is blocked by RLS. Add SUPABASE_SERVICE_ROLE_KEY in your server env or update your RLS policy.',
      );
    }

    buildErrorPath('/seller/products/new', insertError?.message || 'Failed to create product.');
  }

  const preparedImages = await productImageService.prepareProductImages({
    sellerId: userId,
    productId: createdProduct.product_id,
    existingImageUrls: [],
    imageOrder: parsedImagePayload.imageOrder,
    newImages,
  });

  if (!preparedImages.success) {
    await writeClient.from('products').delete().eq('product_id', createdProduct.product_id);
    buildErrorPath('/seller/products/new', preparedImages.error);
  }

  const { error: imageSaveError } = await writeClient
    .from('products')
    .update({
      images: preparedImages.finalImageUrls.length > 0 ? preparedImages.finalImageUrls : null,
    })
    .eq('product_id', createdProduct.product_id)
    .eq('seller_id', userId);

  if (imageSaveError) {
    await productImageService.deleteImagesByUrl(userId, preparedImages.uploadedImageUrls);
    await writeClient.from('products').delete().eq('product_id', createdProduct.product_id);

    buildErrorPath('/seller/products/new', imageSaveError.message);
  }

  revalidatePath('/seller');
  revalidatePath('/seller/products');
  redirect('/seller/products?saved=1');
}

export async function updateProductAction(formData: FormData) {
  const { supabase, userId } = await requireSeller();
  const serviceRoleClient = getServiceRoleSupabase();
  const writeClient = serviceRoleClient ?? supabase;
  const productImageRepository = new SupabaseProductImageRepository(writeClient);
  const productImageService = new ProductImageService(productImageRepository);

  const productId = getString(formData, 'product_id');

  if (!productId) {
    buildErrorPath('/seller/products', 'Product id is missing.');
  }

  const parsedProductPayload = parseProductPayload(formData);
  if (!parsedProductPayload.success) {
    buildErrorPath(`/seller/products/${productId}/edit`, parsedProductPayload.error);
  }

  const parsedImagePayload = parseImagePayload(formData);
  if (!parsedImagePayload.success) {
    buildErrorPath(`/seller/products/${productId}/edit`, parsedImagePayload.error);
  }

  const { data: existingProduct, error: existingProductError } = await writeClient
    .from('products')
    .select('images')
    .eq('product_id', productId)
    .eq('seller_id', userId)
    .maybeSingle();

  if (existingProductError || !existingProduct) {
    buildErrorPath(`/seller/products/${productId}/edit`, 'Product not found.');
  }

  const existingImageUrls = getImageList(existingProduct.images);
  const newImages = parsedImagePayload.newImageFiles.map((file, index) => ({
    token: parsedImagePayload.newImageTokens[index],
    file,
  }));

  const preparedImages = await productImageService.prepareProductImages({
    sellerId: userId,
    productId,
    existingImageUrls,
    imageOrder: parsedImagePayload.imageOrder,
    newImages,
  });

  if (!preparedImages.success) {
    buildErrorPath(`/seller/products/${productId}/edit`, preparedImages.error);
  }

  const { error: updateError } = await writeClient
    .from('products')
    .update({
      category_id: parsedProductPayload.data.categoryId,
      name: parsedProductPayload.data.name,
      price: parsedProductPayload.data.price,
      inventory_quantity: parsedProductPayload.data.inventoryQuantity,
      status: parsedProductPayload.data.status,
      short_description: parsedProductPayload.data.shortDescription,
      description: parsedProductPayload.data.description,
      images: preparedImages.finalImageUrls.length > 0 ? preparedImages.finalImageUrls : null,
    })
    .eq('product_id', productId)
    .eq('seller_id', userId);

  if (updateError) {
    await productImageService.deleteImagesByUrl(userId, preparedImages.uploadedImageUrls);

    if (!serviceRoleClient && /row-level security/i.test(updateError.message)) {
      buildErrorPath(
        `/seller/products/${productId}/edit`,
        'Product update is blocked by RLS. Add SUPABASE_SERVICE_ROLE_KEY in your server env or update your RLS policy.',
      );
    }

    buildErrorPath(`/seller/products/${productId}/edit`, updateError.message);
  }

  if (preparedImages.removedImageUrls.length > 0) {
    await productImageService.deleteImagesByUrl(userId, preparedImages.removedImageUrls);
  }

  revalidatePath('/seller');
  revalidatePath('/seller/products');
  revalidatePath(`/seller/products/${productId}/edit`);
  redirect('/seller/products?updated=1');
}

export async function deleteProductAction(formData: FormData) {
  const { supabase, userId } = await requireSeller();
  const serviceRoleClient = getServiceRoleSupabase();
  const writeClient = serviceRoleClient ?? supabase;

  const productId = getString(formData, 'product_id');
  const returnTo = getString(formData, 'return_to') || '/seller/products';

  if (!productId) {
    buildErrorPath(returnTo, 'Product id is missing.');
  }

  const { error } = await writeClient
    .from('products')
    .delete()
    .eq('product_id', productId)
    .eq('seller_id', userId);

  if (error) {
    if (!serviceRoleClient && /row-level security/i.test(error.message)) {
      buildErrorPath(
        returnTo,
        'Product deletion is blocked by RLS. Add SUPABASE_SERVICE_ROLE_KEY in your server env or update your RLS policy.',
      );
    }

    buildErrorPath(returnTo, error.message);
  }

  revalidatePath('/seller');
  revalidatePath('/seller/products');
  revalidatePath(`/seller/products/${productId}/edit`);
  redirect(appendQueryParam(returnTo, 'deleted', '1'));
}
