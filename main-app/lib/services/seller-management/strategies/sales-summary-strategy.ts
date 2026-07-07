import { fetchSellerSalesData } from '@/lib/repositories/order.repository';
import { createClient } from '@/lib/supabase/server';

export interface SalesSummaryOptions {
  fromIso?: string;
  toIso?: string;
}

export interface SalesSummaryResult {
  totalItemsSold: number;
  totalRevenue: number;
  topProduct?: { product_id: string; name?: string | null; itemsSold: number } | null;
  pendingRefundCount?: number;
}

export async function salesSummaryStrategy(
  sellerId: string,
  options?: SalesSummaryOptions,
  supabaseClientFactory: typeof createClient = createClient,
): Promise<SalesSummaryResult> {
  const sales = await fetchSellerSalesData({
    sellerId,
    fromIso: options?.fromIso,
    toIso: options?.toIso,
  });

  const supabase = await supabaseClientFactory();
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
