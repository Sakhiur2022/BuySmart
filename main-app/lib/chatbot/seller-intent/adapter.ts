import type { SellerIntent } from './schemas';
import type { SellerIntentResult } from './errors';
import type { ListingCreateToolInput, SalesSummaryToolInput } from './tool-contracts';

export interface SellerIntentPayloadAdapter {
  toSalesSummaryInput(
    intent: SellerIntent,
  ): SellerIntentResult<{ toolName: string; input: SalesSummaryToolInput }>;
  toListingCreateInput(
    intent: SellerIntent,
  ): SellerIntentResult<{ toolName: string; input: ListingCreateToolInput }>;
}

export class SellerIntentPayloadAdapterImpl implements SellerIntentPayloadAdapter {
  toSalesSummaryInput(
    intent: SellerIntent,
  ): SellerIntentResult<{ toolName: string; input: SalesSummaryToolInput }> {
    if (intent.intent !== 'SELLER_SALES_SUMMARY') {
      return {
        success: false,
        error: { code: 'INVALID_INTENT', message: 'Not a sales summary intent' },
      };
    }

    const payload = intent.payload ?? {};
    const input: SalesSummaryToolInput = {
      timeframe: (payload as { timeframe?: string }).timeframe,
    };

    return { success: true, value: { toolName: 'seller_sales_summary', input } };
  }

  toListingCreateInput(
    intent: SellerIntent,
  ): SellerIntentResult<{ toolName: string; input: ListingCreateToolInput }> {
    if (intent.intent !== 'SELLER_LISTING_CREATE') {
      return {
        success: false,
        error: { code: 'INVALID_INTENT', message: 'Not a listing create intent' },
      };
    }

    const payload = intent.payload ?? {};
    if (!payload.name || !payload.price) {
      return {
        success: false,
        error: { code: 'INVALID_PAYLOAD', message: 'Missing required listing fields' },
      };
    }

    const input: ListingCreateToolInput = {
      name: String(payload.name),
      price: Number(payload.price),
      category: String(payload.category ?? ''),
      photos: Array.isArray(payload.photos) ? payload.photos.map(String) : [],
      stockQuantity: Number(payload.stockQuantity ?? 0),
    };

    return { success: true, value: { toolName: 'seller_listing_create', input } };
  }
}
