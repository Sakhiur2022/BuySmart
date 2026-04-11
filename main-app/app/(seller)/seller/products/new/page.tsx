import { redirect } from 'next/navigation';
import { ProductForm } from '@/components/forms/product-form';
import { getActiveCategories } from '@/lib/controllers/category.controller';
import { createProductAction } from '@/lib/actions/products';
import { createClient } from '@/lib/supabase/server';

type NewProductPageProps = {
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

export default async function NewProductPage({ searchParams }: NewProductPageProps) {
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

  const resolvedSearchParams = await searchParams;
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
        title="Add Product"
        description="Create a new listing for your storefront."
        submitLabel="Create Product"
        action={createProductAction}
        categories={activeCategories}
      />
    </div>
  );
}
