export const PRODUCT_IMAGE_BUCKET =
  process.env.SUPABASE_PRODUCT_IMAGE_BUCKET?.trim() || 'product-images';

export const PRODUCT_IMAGE_STORAGE_ROOT =
  process.env.SUPABASE_PRODUCT_IMAGE_PATH_PREFIX?.trim() || 'products';
