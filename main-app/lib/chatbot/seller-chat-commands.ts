import type { SalesSummaryToolOutput } from './seller-intent/tool-contracts';
import type { SellerSalesSummaryPreview } from './types';

function normalizeText(message: string) {
  return message.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function isSellerSalesSummaryRequest(message: string) {
  const normalized = normalizeText(message);

  return (
    /\b(how are my sales|sales this week|weekly sales|this week sales|revenue|top product|pending refunds?)\b/.test(
      normalized,
    ) ||
    (/\b(sales|revenue|refunds?)\b/.test(normalized) && /\b(this week|weekly|today|current week)\b/.test(normalized))
  );
}

export function isApproveAllRefundsCommand(message: string) {
  return /\bapprove all refunds\b/i.test(normalizeText(message));
}

export function buildSellerSalesSummaryIntentOutput(sellerId: string) {
  return {
    intent: 'SELLER_SALES_SUMMARY',
    payload: {
      timeframe: 'CURRENT_WEEK' as const,
    },
    metadata: {
      sellerId,
      source: 'seller-chat-summary-flow',
    },
  };
}

export function buildSellerSalesSummaryPreview(
  summary: SalesSummaryToolOutput,
  timeframeLabel = 'This week',
): SellerSalesSummaryPreview {
  return {
    timeframeLabel,
    totalItemsSold: summary.totalItemsSold,
    totalRevenue: summary.totalRevenue,
    topProduct: summary.topProduct
      ? {
          name: summary.topProduct.name?.trim() || 'Top product',
          itemsSold: summary.topProduct.itemsSold,
        }
      : null,
    pendingRefundCount: summary.pendingRefundCount ?? 0,
  };
}