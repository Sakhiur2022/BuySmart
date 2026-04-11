import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

// ============================================================================
// TYPE DEFINITIONS & CONSTANTS
// ============================================================================

interface ProductListItem {
  product_id: string;
  name: string;
  price: number;
  images: unknown;
  short_description: string | null;
}

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;

// ============================================================================
// ZOD SCHEMA
// ============================================================================

const productsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_LIMIT).optional().default(DEFAULT_LIMIT),
  priceMin: z.coerce.number().nonnegative().optional(),
  priceMax: z.coerce.number().nonnegative().optional(),
  categoryId: z.coerce.number().int().nonnegative().optional(),
  search: z.string().optional(),
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatProductListResponse(product: ProductListItem) {
  const images = Array.isArray(product.images) ? product.images : [];

  return {
    product_id: product.product_id,
    name: product.name,
    price: product.price,
    image: images.length > 0 && typeof images[0] === 'string' ? images[0] : undefined,
    short_description: product.short_description,
  };
}

// ============================================================================
// REQUEST HANDLER
// ============================================================================

/**
 * GET /api/products
 * List products with filtering, sorting, and pagination
 *
 * Query parameters:
 * - page: number (default: 1)
 * - pageSize: 1-50 (default: 12)
 * - priceMin: number (optional)
 * - priceMax: number (optional)
 * - categoryId: number (optional)
 * - search: string (optional)
 *
 * Response:
 * {
 *   products: [
 *     {
 *       product_id: string,
 *       name: string,
 *       price: number,
 *       image: string | undefined,
 *       short_description: string | null
 *     }
 *   ],
 *   pagination: {
 *     page: number,
 *     pageSize: number,
 *     totalCount: number,
 *     totalPages: number
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryParams = {
      page: searchParams.get('page') || undefined,
      pageSize: searchParams.get('pageSize') || undefined,
      priceMin: searchParams.get('priceMin') || undefined,
      priceMax: searchParams.get('priceMax') || undefined,
      categoryId: searchParams.get('categoryId') || undefined,
      search: searchParams.get('search') || undefined,
    };

    const parsed = productsQuerySchema.safeParse(queryParams);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { page, pageSize, priceMin, priceMax, categoryId, search } = parsed.data;

    const supabase = await createClient();

    // Build query for active products
    let query = supabase
      .from('products')
      .select(
        `product_id, 
         name, 
         price, 
         images, 
         short_description`,
        { count: 'exact' }
      )
      .eq('status', 'active');

    // Apply price filters
    if (priceMin !== undefined) {
      query = query.gte('price', priceMin);
    }
    if (priceMax !== undefined) {
      query = query.lte('price', priceMax);
    }

    // Filter by category if provided
    if (categoryId !== undefined) {
      query = query.eq('category_id', categoryId);
    }

    // Search by name or description if provided
    if (search) {
      query = query.or(`name.ilike.%${search}%,short_description.ilike.%${search}%`);
    }

    // Sort by creation date (newest first)
    query = query.order('created_at', { ascending: false });

    // Apply pagination
    const offset = (page - 1) * pageSize;
    query = query.range(offset, offset + pageSize - 1);

    const { data: products, count, error } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch products' },
        { status: 500 }
      );
    }

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / pageSize);

    const formattedProducts = (products || []).map((product) =>
      formatProductListResponse(product as ProductListItem)
    );

    return NextResponse.json(
      {
        products: formattedProducts,
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}
