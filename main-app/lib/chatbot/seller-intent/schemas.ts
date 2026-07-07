import { z } from 'zod';

export const SELLER_INTENT_TYPES = ['SELLER_SALES_SUMMARY', 'SELLER_LISTING_CREATE'] as const;
export type SellerIntentType = (typeof SELLER_INTENT_TYPES)[number];

// Metadata schema similar to buyer intent
const metadataSchema = z
  .object({
    confidenceScore: z.number().min(0).max(1).optional(),
    isPartial: z.boolean().optional(),
    source: z.string().min(1).max(120).optional(),
  })
  .optional();

// Payload schemas
export const salesSummaryPayloadSchema = z.object({
  timeframe: z.enum(['CURRENT_WEEK']).optional(),
});

export const listingCreatePayloadSchema = z.object({
  name: z.string().min(1).max(200),
  price: z.number().positive(),
  category: z.string().min(1).max(100),
  photos: z.array(z.string().url()).max(10),
  stockQuantity: z.number().int().nonnegative(),
});

export const sellerSalesSummaryIntentSchema = z.object({
  intent: z.literal('SELLER_SALES_SUMMARY'),
  payload: salesSummaryPayloadSchema,
  metadata: metadataSchema,
});

export const sellerListingCreateIntentSchema = z.object({
  intent: z.literal('SELLER_LISTING_CREATE'),
  payload: listingCreatePayloadSchema,
  metadata: metadataSchema,
});

export const sellerIntentSchema = z.discriminatedUnion('intent', [
  sellerSalesSummaryIntentSchema,
  sellerListingCreateIntentSchema,
]);

export type SellerIntent = z.infer<typeof sellerIntentSchema>;

export type SellerIntentSchema = z.ZodType<SellerIntent>;

export const sellerIntentSchemasByType: Record<SellerIntentType, SellerIntentSchema> = {
  SELLER_SALES_SUMMARY: sellerSalesSummaryIntentSchema,
  SELLER_LISTING_CREATE: sellerListingCreateIntentSchema,
};
