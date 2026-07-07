import type {
  SalesSummaryToolInput,
  SalesSummaryToolOutput,
  ListingCreateToolInput,
  ListingCreateToolOutput,
} from './tool-contracts';
import { SellerManagementToolFacade } from '@/lib/services/seller-management/facade';

export type SellerToolCall =
  | { toolName: 'seller_sales_summary'; input: SalesSummaryToolInput }
  | { toolName: 'seller_listing_create'; input: ListingCreateToolInput };

export async function invokeSellerToolCall(call: SellerToolCall, sellerId: string) {
  const facade = new SellerManagementToolFacade();

  switch (call.toolName) {
    case 'seller_sales_summary': {
      const result = await facade.getSalesSummary(sellerId, {
        fromIso: undefined,
        toIso: undefined,
      });
      return result as SalesSummaryToolOutput;
    }
    case 'seller_listing_create': {
      const res = await facade.createListing(sellerId, call.input);
      return res as ListingCreateToolOutput;
    }
    default:
      throw new Error('Unknown tool call');
  }
}
