import type { BuyerProductListResult, BuyerProductQueryParams } from '@/lib/models/product.model';
import { getBuyerProductListing } from '@/lib/services/product.service';

export async function getBuyerProducts(
  params: BuyerProductQueryParams,
): Promise<BuyerProductListResult> {
  return getBuyerProductListing(params);
}
