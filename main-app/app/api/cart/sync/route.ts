import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { syncLocalCartOnLogin } from '@/lib/services/cart.service';
import { formatCartErrorResponse, requireAuthenticatedUser } from '@/app/api/cart/_shared';

const syncCartSchema = z.object({
  items: z
    .array(
      z.object({
        product_id: z.string().min(1),
        quantity: z.coerce.number().int().positive(),
      }),
    )
    .default([]),
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

    const parsed = syncCartSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const cart = await syncLocalCartOnLogin(userId, parsed.data.items);
    return NextResponse.json({ cart }, { status: 200 });
  } catch (error) {
    const { status, body } = formatCartErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
