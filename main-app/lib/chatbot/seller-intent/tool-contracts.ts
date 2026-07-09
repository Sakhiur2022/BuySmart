export type SalesSummaryToolInput = { timeframe?: 'CURRENT_WEEK' | string };
export type SalesSummaryToolOutput = {
  totalItemsSold: number;
  totalRevenue: number;
  topProduct?: { product_id: string; name?: string | null; itemsSold: number } | null;
  pendingRefundCount?: number;
};

export type ListingCreateToolInput = {
  name: string;
  price: number;
  category: string;
  photos: string[];
  stockQuantity: number;
};

export type ListingCreateToolOutput = { success: boolean; listing: ListingCreateToolInput };

