'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getServiceRoleSupabase } from '@/lib/supabase/service-role';

type ProductStatus = 'draft' | 'active' | 'inactive' | 'out_of_stock' | 'archived';

const ALLOWED_STATUSES: ProductStatus[] = ['draft', 'active', 'inactive', 'out_of_stock'];

function getString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
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

  const name = getString(formData, 'name');
  const price = getNumber(formData, 'price');
  const inventoryQuantity = Math.trunc(getNumber(formData, 'inventory_quantity'));
  const categoryId = getOptionalCategoryId(formData, 'category_id');
  const status = parseStatus(getString(formData, 'status'), 'active');
  const shortDescription = getString(formData, 'short_description');
  const description = getString(formData, 'description');
  const imageUrl = getString(formData, 'image_url');

  if (!name) {
    buildErrorPath('/seller/products/new', 'Product name is required.');
  }

  if (!Number.isFinite(price) || price < 0) {
    buildErrorPath('/seller/products/new', 'Price must be a valid non-negative number.');
  }

  if (!Number.isFinite(inventoryQuantity) || inventoryQuantity < 0) {
    buildErrorPath('/seller/products/new', 'Stock must be a valid non-negative number.');
  }

  if (Number.isNaN(categoryId)) {
    buildErrorPath('/seller/products/new', 'Category must be a valid selection.');
  }

  const { error } = await writeClient.from('products').insert({
    seller_id: userId,
    category_id: categoryId,
    name,
    price,
    inventory_quantity: inventoryQuantity,
    status,
    short_description: shortDescription || null,
    description: description || null,
    images: imageUrl ? [imageUrl] : null,
    inventory_tracked: true,
  });

  if (error) {
    if (!serviceRoleClient && /row-level security/i.test(error.message)) {
      buildErrorPath(
        '/seller/products/new',
        'Product creation is blocked by RLS. Add SUPABASE_SERVICE_ROLE_KEY in your server env or update your RLS policy.',
      );
    }

    buildErrorPath('/seller/products/new', error.message);
  }

  revalidatePath('/seller');
  revalidatePath('/seller/products');
  redirect('/seller/products?saved=1');
}

export async function updateProductAction(formData: FormData) {
  const { supabase, userId } = await requireSeller();
  const serviceRoleClient = getServiceRoleSupabase();
  const writeClient = serviceRoleClient ?? supabase;

  const productId = getString(formData, 'product_id');
  const name = getString(formData, 'name');
  const price = getNumber(formData, 'price');
  const inventoryQuantity = Math.trunc(getNumber(formData, 'inventory_quantity'));
  const categoryId = getOptionalCategoryId(formData, 'category_id');
  const status = parseStatus(getString(formData, 'status'), 'active');
  const shortDescription = getString(formData, 'short_description');
  const description = getString(formData, 'description');
  const imageUrl = getString(formData, 'image_url');

  if (!productId) {
    buildErrorPath('/seller/products', 'Product id is missing.');
  }

  if (!name) {
    buildErrorPath(`/seller/products/${productId}/edit`, 'Product name is required.');
  }

  if (!Number.isFinite(price) || price < 0) {
    buildErrorPath(
      `/seller/products/${productId}/edit`,
      'Price must be a valid non-negative number.',
    );
  }

  if (!Number.isFinite(inventoryQuantity) || inventoryQuantity < 0) {
    buildErrorPath(
      `/seller/products/${productId}/edit`,
      'Stock must be a valid non-negative number.',
    );
  }

  if (Number.isNaN(categoryId)) {
    buildErrorPath(`/seller/products/${productId}/edit`, 'Category must be a valid selection.');
  }

  const { error } = await writeClient
    .from('products')
    .update({
      category_id: categoryId,
      name,
      price,
      inventory_quantity: inventoryQuantity,
      status,
      short_description: shortDescription || null,
      description: description || null,
      images: imageUrl ? [imageUrl] : null,
    })
    .eq('product_id', productId)
    .eq('seller_id', userId);

  if (error) {
    if (!serviceRoleClient && /row-level security/i.test(error.message)) {
      buildErrorPath(
        `/seller/products/${productId}/edit`,
        'Product update is blocked by RLS. Add SUPABASE_SERVICE_ROLE_KEY in your server env or update your RLS policy.',
      );
    }

    buildErrorPath(`/seller/products/${productId}/edit`, error.message);
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
