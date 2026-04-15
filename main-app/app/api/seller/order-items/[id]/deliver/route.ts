import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const ALLOWED_STATUSES = new Set(['pending', 'confirmed', 'shipped']);

async function requireSellerAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('UNAUTHENTICATED');
  }

  const { data: profile } = await supabase
    .from('users_profile')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profile?.role !== 'seller') {
    throw new Error('FORBIDDEN');
  }

  return { supabase, userId: user.id };
}

function formatErrorResponse(error: unknown) {
  if (error instanceof Error) {
    if (error.message === 'UNAUTHENTICATED') {
      return { status: 401, body: { error: 'Unauthorized: Not authenticated' } };
    }

    if (error.message === 'FORBIDDEN') {
      return { status: 403, body: { error: 'Forbidden: Only sellers can access this endpoint' } };
    }

    if (error.message === 'INVALID_STATUS') {
      return { status: 409, body: { error: 'Order item status cannot be marked delivered.' } };
    }
  }

  return { status: 500, body: { error: 'Internal server error' } };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsedParams = paramsSchema.safeParse(await params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: 'Invalid order item id' }, { status: 400 });
  }

  try {
    const { supabase, userId } = await requireSellerAuth();
    const orderItemId = parsedParams.data.id;

    const { data: orderItem, error: orderItemError } = await supabase
      .from('order_items')
      .select('order_item_id, order_id, status')
      .eq('order_item_id', orderItemId)
      .eq('seller_id', userId)
      .maybeSingle();

    if (orderItemError) {
      throw new Error(orderItemError.message);
    }

    if (!orderItem) {
      return NextResponse.json({ error: 'Order item not found' }, { status: 404 });
    }

    if (orderItem.status === 'delivered') {
      return NextResponse.json({ ok: true, orderId: orderItem.order_id }, { status: 200 });
    }

    if (!ALLOWED_STATUSES.has(orderItem.status)) {
      throw new Error('INVALID_STATUS');
    }

    const { error: updateError } = await supabase
      .from('order_items')
      .update({ status: 'delivered' })
      .eq('order_item_id', orderItem.order_item_id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    const { data: orderItems, error: orderItemsError } = await supabase
      .from('order_items')
      .select('status')
      .eq('order_id', orderItem.order_id);

    if (orderItemsError) {
      throw new Error(orderItemsError.message);
    }

    const allDelivered = (orderItems ?? []).every((item) => item.status === 'delivered');

    if (allDelivered) {
      const deliveredAt = new Date().toISOString();
      const { error: orderUpdateError } = await supabase
        .from('orders')
        .update({ status: 'delivered', delivered_at: deliveredAt })
        .eq('order_id', orderItem.order_id);

      if (orderUpdateError) {
        throw new Error(orderUpdateError.message);
      }
    }

    return NextResponse.json({ ok: true, orderId: orderItem.order_id }, { status: 200 });
  } catch (error) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
