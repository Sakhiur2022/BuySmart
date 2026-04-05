import { NextResponse } from 'next/server';
import { getFullCartWithProductDetails } from '@/lib/services/cart.service';
import { formatCartErrorResponse, requireAuthenticatedUser } from '@/app/api/cart/_shared';

export async function GET() {
  try {
    const { userId } = await requireAuthenticatedUser();
    const cart = await getFullCartWithProductDetails(userId);

    return NextResponse.json({ cart }, { status: 200 });
  } catch (error) {
    const { status, body } = formatCartErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
