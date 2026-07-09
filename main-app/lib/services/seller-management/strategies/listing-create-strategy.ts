import { createSellerProduct } from '@/lib/services/product.service';

export interface ListingCreatePayload {
  name: string;
  price: number;
  category: string;
  photos: string[];
  stockQuantity: number;
}

export async function listingCreateStrategy(sellerId: string, payload: ListingCreatePayload) {
  // Basic validation
  if (!payload || typeof payload.name !== 'string' || payload.name.trim().length === 0) {
    throw new Error('Invalid product name');
  }
  if (!Number.isFinite(payload.price) || payload.price < 0) {
    throw new Error('Invalid price');
  }
  if (!Array.isArray(payload.photos)) {
    payload.photos = [];
  }

  await createSellerProduct(sellerId, {
    name: payload.name,
    price: payload.price,
    category: payload.category,
    photos: payload.photos,
    stockQuantity: payload.stockQuantity,
  });

  return { success: true, listing: { ...payload, photos: [...payload.photos] } };
}

