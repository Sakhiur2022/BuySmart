import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createOrderFromInput, getBuyerOrders } from '@/lib/services/order.service';
import { requireAuthenticatedUser } from '@/app/api/cart/_shared';
import type { OrderStatus } from '@/lib/models/order.model';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const ORDER_STATUS_VALUES: OrderStatus[] = [
  'draft',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'completed',
  'cancelled',
];

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

const getOrdersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional().default(DEFAULT_PAGE_SIZE),
  status: z.enum(ORDER_STATUS_VALUES).optional(),
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
      return { status: 403, body: { error: 'Forbidden: Only buyers can access orders' } };
    }

    if (error.message === 'Order not found') {
      return { status: 404, body: { error: 'Order not found' } };
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

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuthenticatedUser();

    const searchParams = request.nextUrl.searchParams;
    const queryParams = {
      page: searchParams.get('page') || undefined,
      pageSize: searchParams.get('pageSize') || undefined,
      status: searchParams.get('status') || undefined,
    };

    const parsed = getOrdersQuerySchema.safeParse(queryParams);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const result = await getBuyerOrders(userId, parsed.data);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const { status, body } = formatOrderErrorResponse(error);
    return NextResponse.json(body, { status });
  }
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
