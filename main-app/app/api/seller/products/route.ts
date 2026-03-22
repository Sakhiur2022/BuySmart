import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/types/database.types';

// ============================================================================
// TYPE DEFINITIONS & CONSTANTS
// ============================================================================

type Product = Database['public']['Tables']['products']['Row'];
type ProductStatus = Database['public']['Enums']['product_status_enum'];

const ALLOWED_STATUSES: ProductStatus[] = ['draft', 'active', 'inactive', 'out_of_stock'];
const ALLOWED_SORT_FIELDS = ['name', 'price', 'created_at'] as const;
const ALLOWED_SORT_ORDERS = ['asc', 'desc'] as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Authentication helper - verifies user is authenticated and is a seller
 * Returns supabase client and authenticated user ID
 */
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

/**
 * Format product response - extract only needed fields
 * Returns: id, name, price, image (first from array), description
 */
function formatProductResponse(product: Product) {
  const images = Array.isArray(product.images) ? product.images : [];
  const firstImage = images.length > 0 ? images[0] : null;

  return {
    id: product.product_id,
    name: product.name,
    price: product.price,
    image: firstImage,
    description: product.description,
  };
}

/**
 * Format full product response for create/update operations
 */
function formatFullProductResponse(product: Product) {
  return {
    product_id: product.product_id,
    name: product.name,
    price: product.price,
    inventory_quantity: product.inventory_quantity,
    status: product.status,
    short_description: product.short_description,
    description: product.description,
    images: product.images,
    category_id: product.category_id,
    created_at: product.created_at,
    updated_at: product.updated_at,
  };
}

/**
 * Error formatter for API responses
 */
function formatErrorResponse(error: unknown) {
  if (error instanceof Error) {
    if (error.message === 'UNAUTHENTICATED') {
      return { status: 401, body: { error: 'Unauthorized: Not authenticated' } };
    }
    if (error.message === 'FORBIDDEN') {
      return { status: 403, body: { error: 'Forbidden: Only sellers can access this endpoint' } };
    }
  }
  return { status: 500, body: { error: 'Internal server error' } };
}

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

const listQuerySchema = z.object({
  status: z
    .enum(ALLOWED_STATUSES)
    .optional(),
  category_id: z.coerce.number().int().nonnegative().optional(),
  sortBy: z.enum(ALLOWED_SORT_FIELDS).optional().default('created_at'),
  sortOrder: z.enum(ALLOWED_SORT_ORDERS).optional().default('desc'),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

const createPayloadSchema = z.object({
  name: z.string().min(1).max(255),
  price: z.number().positive(),
  inventory_quantity: z.number().int().nonnegative(),
  status: z.enum(ALLOWED_STATUSES).optional().default('active'),
  short_description: z.string().max(500).optional(),
  description: z.string().optional(),
  category_id: z.number().int().nonnegative().optional(),
});

const updatePayloadSchema = createPayloadSchema.partial();

// ============================================================================
// HANDLERS
// ============================================================================

/**
 * GET /api/seller/products
 * List seller's products with filtering, sorting, and pagination
 *
 * Query parameters:
 * - status: draft|active|inactive|out_of_stock (optional)
 * - category_id: number (optional)
 * - sortBy: name|price|created_at (default: created_at)
 * - sortOrder: asc|desc (default: desc)
 * - page: number (default: 1)
 * - pageSize: 1-100 (default: 20)
 *
 * Example: GET /api/seller/products?status=active&sortBy=price&sortOrder=desc&page=1&pageSize=10
 */
export async function GET(request: NextRequest) {
  try {
    const { supabase, userId } = await requireSellerAuth();

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryParams = {
      status: searchParams.get('status') || undefined,
      category_id: searchParams.get('category_id') || undefined,
      sortBy: searchParams.get('sortBy') || undefined,
      sortOrder: searchParams.get('sortOrder') || undefined,
      page: searchParams.get('page') || undefined,
      pageSize: searchParams.get('pageSize') || undefined,
    };

    const parsed = listQuerySchema.safeParse(queryParams);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { status, category_id, sortBy, sortOrder, page, pageSize } = parsed.data;

    // Build query
    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('seller_id', userId);

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (category_id !== undefined) {
      query = query.eq('category_id', category_id);
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

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
    const formattedProducts = products?.map(formatProductResponse) || [];

    return NextResponse.json(
      {
        products: formattedProducts,
        pagination: {
          totalCount,
          page,
          pageSize,
          totalPages,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

/**
 * POST /api/seller/products
 * Create a new product
 *
 * Request body:
 * {
 *   name: string (required),
 *   price: number (required, > 0),
 *   inventory_quantity: number (required, >= 0),
 *   status: draft|active|inactive|out_of_stock (optional, default: active),
 *   short_description: string (optional),
 *   description: string (optional),
 *   category_id: number (optional)
 * }
 *
 * Example:
 * POST /api/seller/products
 * {
 *   "name": "Wireless Headphones",
 *   "price": 79.99,
 *   "inventory_quantity": 50,
 *   "status": "active",
 *   "description": "High-quality wireless headphones"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase, userId } = await requireSellerAuth();

    // Parse request body
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    const parsed = createPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const productData = {
      ...parsed.data,
      seller_id: userId,
    };

    const { data: product, error } = await supabase
      .from('products')
      .insert([productData])
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Failed to create product - check if seller role is properly set' },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to create product' },
        { status: 500 }
      );
    }

    return NextResponse.json(formatFullProductResponse(product), { status: 201 });
  } catch (error) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

/**
 * PATCH /api/seller/products?id=<product_id>
 * Update an existing product
 *
 * Query parameters:
 * - id: product_id (required)
 *
 * Request body: Same as POST but all fields optional
 *
 * Example:
 * PATCH /api/seller/products?id=prod_123
 * { "price": 89.99, "inventory_quantity": 45 }
 */
export async function PATCH(request: NextRequest) {
  try {
    const { supabase, userId } = await requireSellerAuth();

    // Extract product ID from query params
    const productId = request.nextUrl.searchParams.get('id');
    if (!productId) {
      return NextResponse.json(
        { error: 'Missing required query parameter: id' },
        { status: 400 }
      );
    }

    // Parse request body
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    const parsed = updatePayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    // Verify product exists and belongs to seller
    const { data: existingProduct, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .eq('product_id', productId)
      .eq('seller_id', userId)
      .maybeSingle();

    if (fetchError) {
      console.error('Database error:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch product' },
        { status: 500 }
      );
    }

    if (!existingProduct) {
      return NextResponse.json(
        { error: 'Product not found or does not belong to seller' },
        { status: 404 }
      );
    }

    // Update product
    const { data: updatedProduct, error: updateError } = await supabase
      .from('products')
      .update(parsed.data)
      .eq('product_id', productId)
      .eq('seller_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Database error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update product' },
        { status: 500 }
      );
    }

    return NextResponse.json(formatFullProductResponse(updatedProduct), { status: 200 });
  } catch (error) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

/**
 * DELETE /api/seller/products?id=<product_id>
 * Delete a product
 *
 * Query parameters:
 * - id: product_id (required)
 *
 * Example:
 * DELETE /api/seller/products?id=prod_123
 */
export async function DELETE(request: NextRequest) {
  try {
    const { supabase, userId } = await requireSellerAuth();

    // Extract product ID from query params
    const productId = request.nextUrl.searchParams.get('id');
    if (!productId) {
      return NextResponse.json(
        { error: 'Missing required query parameter: id' },
        { status: 400 }
      );
    }

    // Verify product exists and belongs to seller
    const { data: existingProduct, error: fetchError } = await supabase
      .from('products')
      .select('product_id')
      .eq('product_id', productId)
      .eq('seller_id', userId)
      .maybeSingle();

    if (fetchError) {
      console.error('Database error:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch product' },
        { status: 500 }
      );
    }

    if (!existingProduct) {
      return NextResponse.json(
        { error: 'Product not found or does not belong to seller' },
        { status: 404 }
      );
    }

    // Delete product
    const { error: deleteError } = await supabase
      .from('products')
      .delete()
      .eq('product_id', productId)
      .eq('seller_id', userId);

    if (deleteError) {
      console.error('Database error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete product' },
        { status: 500 }
      );
    }

    return NextResponse.json(null, { status: 204 });
  } catch (error) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
