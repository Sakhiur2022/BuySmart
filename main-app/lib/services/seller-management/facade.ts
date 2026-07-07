import { fetchSellerSalesData } from '@/lib/repositories/order.repository';
import { createSellerProduct } from '@/lib/services/product.service';
import { createClient } from '@/lib/supabase/server';

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
    const sales = await fetchSellerSalesData({
      sellerId,
      fromIso: options?.fromIso,
      toIso: options?.toIso,
    });

    // Count pending refunds scoped to this seller
    const supabase = await this.supabaseClientFactory();
    const { data: orderIdsData, error: orderIdsError } = await supabase
      .from('order_items')
      .select('order_id')
      .eq('seller_id', sellerId);

    if (orderIdsError) {
      throw new Error(orderIdsError.message);
    }

    const orderIds = Array.from(new Set((orderIdsData ?? []).map((r: any) => r.order_id)));

    let pendingRefundCount = 0;
    if (orderIds.length > 0) {
      const { count, error } = await supabase
        .from('refunds')
        .select('refund_id', { count: 'exact', head: true })
        .in('order_id', orderIds)
        .eq('status', 'pending');

      if (error) {
        throw new Error(error.message);
      }

      pendingRefundCount = count ?? 0;
    }

    return {
      totalItemsSold: sales.totalItemsSold,
      totalRevenue: sales.totalRevenue,
      topProduct: sales.topProduct ?? null,
      pendingRefundCount,
    };
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
    // Delegate to product service which validates and inserts the product
    await createSellerProduct(sellerId, {
      name: payload.name,
      price: payload.price,
      category: payload.category,
      photos: payload.photos,
      stockQuantity: payload.stockQuantity,
    });

    return { success: true };
  }
}
