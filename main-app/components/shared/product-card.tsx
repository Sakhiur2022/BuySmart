'use client';

import Image from 'next/image';

export interface Product {
  product_id: string;
  id: string;
  title: string;
  description?: string | null;
  price: number;
  image_url?: string;
  images?: unknown;
  category_id?: number | null;
}

function getImageUrl(product: Product) {
  if (product.image_url) {
    return product.image_url;
  }

  if (!product.images) {
    return 'https://via.placeholder.com/300';
  }

  if (typeof product.images === 'string') {
    return product.images;
  }

  if (Array.isArray(product.images) && product.images.length > 0) {
    const first = product.images[0];
    if (typeof first === 'string') {
      return first;
    }

    if (first && typeof first === 'object' && 'url' in first && typeof first.url === 'string') {
      return first.url;
    }
  }

  if (
    product.images &&
    typeof product.images === 'object' &&
    'url' in product.images &&
    typeof product.images.url === 'string'
  ) {
    return product.images.url;
  }

  return 'https://via.placeholder.com/300';
}

export function ProductCard({
  product,
  viewMode,
}: {
  product: Product;
  viewMode: 'grid' | 'list';
}) {
  const isList = viewMode === 'list';

  return (
    <div
      className={`
      group bg-card text-card-foreground rounded-lg border border-border 
      transition-all duration-200 hover:shadow-md hover:border-primary/40
      ${isList ? 'flex h-44' : 'flex flex-col'}
    `}
    >
      <div
        className={`${isList ? 'w-48' : 'w-full h-48'} relative overflow-hidden rounded-t-lg ${isList ? 'rounded-tr-none rounded-l-lg' : ''}`}
      >
        <Image
          src={getImageUrl(product)}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          alt={product.title}
          unoptimized
        />
      </div>

      <div className="p-4 flex flex-col justify-between grow">
        <div>
          <h3 className="font-sans font-bold tracking-tight text-foreground line-clamp-1">
            {product.title}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{product.description}</p>
        </div>

        <div className="flex justify-between items-center mt-4">
          <span className="font-mono font-bold text-lg tabular-nums">
            {product.price.toFixed(2)}{' '}
            <span className="text-xs font-sans text-muted-foreground font-normal">BDT</span>
          </span>
          <button className="bg-primary text-primary-foreground px-4 py-1.5 rounded-md text-xs font-medium shadow-sm active:scale-95 transition-all hover:bg-primary/90">
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}
