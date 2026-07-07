import { salesSummaryStrategy } from './strategies/sales-summary-strategy';
import { listingCreateStrategy } from './strategies/listing-create-strategy';
import { createClient } from '@/lib/supabase/server';
import type { SalesSummaryOptions } from './strategies/sales-summary-strategy';

export interface SalesSummaryResult {
  totalItemsSold: number;
  totalRevenue: number;
  topProduct?: { product_id: string; name?: string | null; itemsSold: number } | null;
  pendingRefundCount?: number;
}

export class SellerManagementToolFacade {
  constructor(private readonly supabaseClientFactory: typeof createClient = createClient) {}

  public async getSalesSummary(
    sellerId: string,
    options?: { fromIso?: string; toIso?: string },
  ): Promise<SalesSummaryResult> {
    const opts: SalesSummaryOptions | undefined = options
      ? { fromIso: options.fromIso, toIso: options.toIso }
      : undefined;

    return salesSummaryStrategy(sellerId, opts, this.supabaseClientFactory);
  }

  public async createListing(
    sellerId: string,
    payload: {
      name: string;
      price: number;
      category: string;
      photos: string[];
      stockQuantity: number;
    },
  ) {
    return listingCreateStrategy(sellerId, {
      name: payload.name,
      price: payload.price,
      category: payload.category,
      photos: payload.photos,
      stockQuantity: payload.stockQuantity,
    });
  }
}
