import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createOrderFromInput } from '@/lib/services/order.service';
import { requireAuthenticatedUser } from '@/app/api/cart/_shared';

const orderAddressSchema = z.object({
  full_name: z.string().min(1).max(120),
  phone: z.string().min(1).max(30),
  address_line_1: z.string().min(1).max(255),
  address_line_2: z.string().max(255).optional(),
  city: z.string().min(1).max(120),
  state: z.string().max(120).optional(),
  postal_code: z.string().max(30).optional(),
  country: z.string().min(2).max(120),
});

const directItemSchema = z.object({
  product_id: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
});

const createOrderSchema = z
  .object({
    source: z.enum(['cart', 'direct']),
    items: z.array(directItemSchema).max(100).optional(),
    notes: z.string().max(1000).optional(),
    shipping_address: orderAddressSchema.optional(),
    billing_address: orderAddressSchema.optional(),
    shipping_amount: z.coerce.number().min(0).max(100000).optional(),
    tax_amount: z.coerce.number().min(0).max(100000).optional(),
    discount_amount: z.coerce.number().min(0).max(100000).optional(),
    currency: z.string().min(3).max(3).optional(),
    payment_method: z.string().max(60).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.source === 'direct') {
      if (!value.items || value.items.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'items are required when source is direct',
          path: ['items'],
        });
      }
    }
  });

function formatOrderErrorResponse(error: unknown): {
  status: number;
  body: { error: string };
} {
  if (error instanceof Error) {
    if (error.message === 'UNAUTHENTICATED') {
      return { status: 401, body: { error: 'Unauthorized: Not authenticated' } };
    }

    if (error.message === 'FORBIDDEN') {
      return { status: 403, body: { error: 'Forbidden: Only buyers can create orders' } };
    }

    if (
      error.message.includes('required') ||
      error.message.includes('Invalid') ||
      error.message.includes('No items available') ||
      error.message.includes('No valid items available') ||
      error.message.includes('cannot be negative')
    ) {
      return { status: 400, body: { error: error.message } };
    }
  }

  return { status: 500, body: { error: 'Internal server error' } };
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuthenticatedUser();

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const parsed = createOrderSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const created = await createOrderFromInput(userId, parsed.data);
    return NextResponse.json({ order: created }, { status: 201 });
  } catch (error) {
    const { status, body } = formatOrderErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
