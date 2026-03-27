'use server';

import type { BuyerProductListResult, BuyerProductQueryParams } from '@/lib/models/product.model';
import { getBuyerProducts } from '@/lib/controllers/product.controller';

export async function getBuyerProductsAction(
  params: BuyerProductQueryParams,
): Promise<BuyerProductListResult> {
  return getBuyerProducts(params);
}
