import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { addCartItem, clearUserCart } from '@/lib/services/cart.service';
import { formatCartErrorResponse, requireAuthenticatedUser } from '@/app/api/cart/_shared';

const addCartItemSchema = z.object({
  product_id: z.string().min(1),
  quantity: z.coerce.number().int().positive().optional().default(1),
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuthenticatedUser();

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const parsed = addCartItemSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const cart = await addCartItem(userId, parsed.data.product_id, parsed.data.quantity);
    return NextResponse.json({ cart }, { status: 200 });
  } catch (error) {
    const { status, body } = formatCartErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE() {
  try {
    const { userId } = await requireAuthenticatedUser();
    const cart = await clearUserCart(userId);

    return NextResponse.json({ cart }, { status: 200 });
  } catch (error) {
    const { status, body } = formatCartErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
