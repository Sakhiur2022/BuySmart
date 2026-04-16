import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceRoleSupabase } from '@/lib/supabase/service-role';

type ProductViewPayload = {
  productId: string;
  productName?: string;
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  if (!data.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: ProductViewPayload;

  try {
    payload = (await request.json()) as ProductViewPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const productId = payload.productId?.trim();
  if (!productId) {
    return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
  }

  const serviceRole = getServiceRoleSupabase();
  const insertClient = serviceRole ?? supabase;
  const { error: insertError } = await insertClient.from('activity_logs').insert({
    activity_type: 'product_view',
    action: 'view',
    user_id: data.user.id,
    entity_id: productId,
    entity_type: 'product',
    severity: 'info',
    status: 'success',
    metadata: {
      product_id: productId,
      product_name: payload.productName ?? null,
    },
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
