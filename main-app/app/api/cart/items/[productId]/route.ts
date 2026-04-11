import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { removeCartItemByProduct, updateCartItemQuantity } from '@/lib/services/cart.service';
import { formatCartErrorResponse, requireAuthenticatedUser } from '@/app/api/cart/_shared';

const updateQuantitySchema = z.object({
  quantity: z.coerce.number().int().positive(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> },
) {
  try {
    const { userId } = await requireAuthenticatedUser();
    const { productId } = await params;

    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const parsed = updateQuantitySchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const cart = await updateCartItemQuantity(userId, productId, parsed.data.quantity);
    return NextResponse.json({ cart }, { status: 200 });
  } catch (error) {
    const { status, body } = formatCartErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ productId: string }> },
) {
  try {
    const { userId } = await requireAuthenticatedUser();
    const { productId } = await params;

    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const cart = await removeCartItemByProduct(userId, productId);
    return NextResponse.json({ cart }, { status: 200 });
  } catch (error) {
    const { status, body } = formatCartErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
