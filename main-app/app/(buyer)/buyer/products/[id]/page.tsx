import { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ProductDetailComponent from '@/components/products/product-detail-component';

// ============================================================================
// TYPES
// ============================================================================

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

interface ProductData {
  product: {
    product_id: string;
    name: string;
    price: number;
    description: string | null;
    short_description: string | null;
    images: string[];
    category?: {
      category_id: number;
      name: string;
    } | null;
    seller?: {
      user_id: string;
      full_name: string;
      avatar_url: string | null;
    } | null;
    status: string;
    created_at: string;
  };
  reviews: {
    average_rating: number;
    total_reviews: number;
    rating_distribution: { [key: string]: number };
  };
  relatedProducts: Array<{
    product_id: string;
    name: string;
    price: number;
    image?: string;
    short_description: string | null;
  }>;
}

// ============================================================================
// METADATA GENERATION
// ============================================================================

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const requestHeaders = await headers();
  const host = requestHeaders.get('host') || 'localhost:3000';
  const protocol = requestHeaders.get('x-forwarded-proto') || 'http';
  const appUrl = `${protocol}://${host}`;

  try {
    const response = await fetch(`${appUrl}/api/products/${id}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      return {
        title: 'Product Not Found | BuySmart',
        description: 'The product you are looking for does not exist.',
      };
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.error('Invalid content type from API:', contentType);
      return {
        title: 'Product | BuySmart',
        description: 'View product details on BuySmart',
      };
    }

    const data: ProductData = await response.json();
    const { product } = data;

    return {
      title: `${product.name} | BuySmart`,
      description:
        product.short_description || product.description || 'View product details on BuySmart',
      keywords: [product.name, product.category?.name, 'buy', 'shopping'].filter(
        (k) => k !== undefined,
      ) as string[],
      openGraph: {
        title: product.name,
        description: product.short_description || product.description || undefined,
        images: product.images.slice(0, 1),
        url: `${appUrl}/buyer/products/${product.product_id}`,
        type: 'website',
      },
    };
  } catch (error) {
    console.error('Error generating metadata:', error);
    return {
      title: 'Product | BuySmart',
      description: 'View product details on BuySmart',
    };
  }
}

// ============================================================================
// SERVER COMPONENT
// ============================================================================

export default async function ProductDetailPage({ params }: PageProps) {
  const { id } = await params;

  try {
    const requestHeaders = await headers();
    const host = requestHeaders.get('host') || 'localhost:3000';
    const protocol = requestHeaders.get('x-forwarded-proto') || 'http';
    const appUrl = `${protocol}://${host}`;

    // Fetch product detail data
    const response = await fetch(`${appUrl}/api/products/${id}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      if (response.status === 404) {
        notFound();
      }
      throw new Error(`API returned status ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.error('Invalid content type from API:', contentType, 'for product:', id);
      throw new Error('API returned non-JSON response');
    }

    const data: ProductData = await response.json();

    // If product belongs to seller trying to access it, redirect to seller view
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user && data.product.seller?.user_id === user.id) {
      redirect(`/seller/products/${id}`);
    }

    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
        <ProductDetailComponent productData={data} />
      </div>
    );
  } catch (error) {
    if (error instanceof Error) {
      const digest = (error as Error & { digest?: string }).digest;

      if (typeof digest === 'string') {
        if (digest.startsWith('NEXT_REDIRECT')) {
          throw error;
        }

        if (digest.startsWith('NEXT_HTTP_ERROR_FALLBACK;404')) {
          throw error;
        }
      }
    }

    console.error('Error loading product page:', error);
    notFound();
  }
}
