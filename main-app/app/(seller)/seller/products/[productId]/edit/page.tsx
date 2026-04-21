import { redirect } from 'next/navigation';
import { ProductForm } from '@/components/forms/product-form';
import { getActiveCategories } from '@/lib/controllers/category.controller';
import { updateProductAction } from '@/lib/actions/products';
import { createClient } from '@/lib/supabase/server';

type EditProductPageProps = {
  params: Promise<{
    productId: string;
  }>;
  searchParams?: Promise<{
    error?: string | string[];
  }>;
};

function getSearchValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function pickImages(images: unknown): string[] {
  if (!Array.isArray(images)) {
    return [];
  }

  return images.filter(
    (image): image is string => typeof image === 'string' && image.trim().length > 0,
  );
}

export default async function EditProductPage({ params, searchParams }: EditProductPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
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

  const { data: product } = await supabase
    .from('products')
    .select(
      'product_id, name, price, inventory_quantity, status, short_description, description, images, category_id',
    )
    .eq('product_id', resolvedParams.productId)
    .eq('seller_id', user.id)
    .maybeSingle();

  if (!product) {
    redirect('/seller/products');
  }

  const error = getSearchValue(resolvedSearchParams?.error);
  const activeCategories = await getActiveCategories();

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      <ProductForm
        title="Edit Product"
        description="Update your listing information and inventory details."
        submitLabel="Save Changes"
        action={updateProductAction}
        categories={activeCategories}
        values={{
          productId: product.product_id,
          categoryId: product.category_id ?? null,
          name: product.name,
          price: product.price,
          inventoryQuantity: product.inventory_quantity,
          status: product.status,
          shortDescription: product.short_description ?? '',
          description: product.description ?? '',
          imageUrls: pickImages(product.images),
        }}
      />
    </div>
  );
}
