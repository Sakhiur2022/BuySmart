import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceRoleSupabase } from '@/lib/supabase/service-role';

type RedirectResult = NextResponse;

function getStringValue(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

function getSafeReturnTo(value: FormDataEntryValue | null): string {
  const trimmed = getStringValue(value);
  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  return '/seller/products';
}

function buildRedirect(request: Request, basePath: string, key: string, value: string): RedirectResult {
  const url = new URL(basePath, request.url);
  url.searchParams.set(key, value);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const productId = getStringValue(formData.get('product_id'));
  const returnTo = getSafeReturnTo(formData.get('return_to'));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL('/auth/login', request.url), 303);
  }

  const { data: profile } = await supabase
    .from('users_profile')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profile?.role !== 'seller') {
    return NextResponse.redirect(new URL('/buyer', request.url), 303);
  }

  if (!productId) {
    return buildRedirect(request, returnTo, 'error', 'Product id is missing.');
  }

  const serviceRoleClient = getServiceRoleSupabase();
  const writeClient = serviceRoleClient ?? supabase;

  const { error } = await writeClient
    .from('products')
    .delete()
    .eq('product_id', productId)
    .eq('seller_id', user.id);

  if (error) {
    if (!serviceRoleClient && /row-level security/i.test(error.message)) {
      return buildRedirect(
        request,
        returnTo,
        'error',
        'Product deletion is blocked by RLS. Add SUPABASE_SERVICE_ROLE_KEY in your server env or update your RLS policy.',
      );
    }

    return buildRedirect(request, returnTo, 'error', error.message);
  }

  return buildRedirect(request, returnTo, 'deleted', '1');
}
