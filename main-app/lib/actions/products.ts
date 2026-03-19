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

function buildErrorPath(basePath: string, message: string): never {
  const query = encodeURIComponent(message);
  redirect(`${basePath}?error=${query}`);
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

  const { error } = await writeClient.from('products').insert({
    seller_id: userId,
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

  const { error } = await writeClient
    .from('products')
    .update({
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
