import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

interface ProductLookupItem {
  product_id: string;
  name: string;
  price: number;
  images: unknown;
  short_description: string | null;
}

const MAX_LOOKUP_IDS = 50;

const lookupQuerySchema = z.object({
  ids: z.string().min(1),
});

function formatProductLookupResponse(product: ProductLookupItem) {
  const images = Array.isArray(product.images) ? product.images : [];

  return {
    product_id: product.product_id,
    name: product.name,
    price: product.price,
    image: images.length > 0 && typeof images[0] === 'string' ? images[0] : undefined,
    short_description: product.short_description,
  };
}

function parseIds(idsParam: string): string[] {
  const uniqueIds = new Set(
    idsParam
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0),
  );

  return Array.from(uniqueIds);
}

/**
 * GET /api/products/lookup?ids=prod_1,prod_2
 * Returns a list of active products for the given IDs.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const parsed = lookupQuerySchema.safeParse({
      ids: searchParams.get('ids') || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const ids = parseIds(parsed.data.ids);
    if (ids.length === 0) {
      return NextResponse.json({ error: 'At least one product id is required' }, { status: 400 });
    }

    if (ids.length > MAX_LOOKUP_IDS) {
      return NextResponse.json(
        { error: `A maximum of ${MAX_LOOKUP_IDS} product ids is allowed` },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { data: products, error } = await supabase
      .from('products')
      .select('product_id, name, price, images, short_description')
      .eq('status', 'active')
      .in('product_id', ids);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
    }

    const formattedProducts = (products || []).map((product) =>
      formatProductLookupResponse(product as ProductLookupItem),
    );

    return NextResponse.json({ products: formattedProducts }, { status: 200 });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}
