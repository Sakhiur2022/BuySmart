import { z } from 'zod';

import {
  BUYER_INTENT_TYPES,
  type BuyerIntent,
  type BuyerIntentType,
} from '@/lib/chatbot/buyer-intent/types';

const metadataSchema = z
  .object({
    confidenceScore: z.number().min(0).max(1).optional(),
    isPartial: z.boolean().optional(),
    source: z.string().min(1).max(120).optional(),
  })
  .optional();

export const buyerIntentTypeSchema = z.enum(BUYER_INTENT_TYPES);

export const refundReasonSignalSchema = z.enum(['damage', 'non_delivery', 'wrong_item', 'other']);

export const refundEvidenceSignalSchema = z.enum(['photo_attached', 'no_photo', 'unknown']);

export const refundOrderSignalSchema = z.object({
  orderId: z.string().min(1).max(120).optional(),
  recentOrders: z.boolean().optional(),
  orderDescription: z.string().min(1).max(500).optional(),
});

export const refundItemSignalSchema = z.object({
  productId: z.string().uuid(),
  orderItemId: z.string().uuid().optional().nullable(),
  quantity: z.number().int().positive(),
  unitAmount: z.number().min(0).max(1000000),
  totalAmount: z.number().min(0).max(1000000).optional(),
});

export const refundRequestPayloadSchema = z.object({
  orderSignal: refundOrderSignalSchema.optional(),
  reason: refundReasonSignalSchema.optional(),
  reasonDescription: z.string().max(1000).optional(),
  evidence: refundEvidenceSignalSchema.optional(),
  evidenceImages: z.array(z.string().url()).max(10).optional(),
  requestedAmount: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
  items: z.array(refundItemSignalSchema).max(100).optional(),
  buyerId: z.string().uuid().optional(),
});

export const recommendationRecipientSchema = z.enum(['self', 'gift', 'unknown']);

export const recommendationBudgetSchema = z
  .object({
    min: z.number().min(0).optional(),
    max: z.number().min(0).optional(),
    currency: z.string().length(3).optional(),
  })
  .refine((value) => value.min === undefined || value.max === undefined || value.min <= value.max, {
    message: 'min must be less than or equal to max',
  });

export const productRecommendationPayloadSchema = z.object({
  budget: recommendationBudgetSchema.optional(),
  category: z.string().min(1).max(120).optional(),
  occasion: z.string().min(1).max(120).optional(),
  recipient: recommendationRecipientSchema.optional(),
  attributes: z.array(z.string().min(1).max(80)).max(20).optional(),
});

export const policyDomainSchema = z.enum(['returns', 'shipping', 'payments', 'account', 'other']);

export const policyConfidenceSchema = z.enum(['certain', 'ambiguous']);

export const policyQaPayloadSchema = z.object({
  question: z.string().min(1).max(600),
  domain: policyDomainSchema,
  confidence: policyConfidenceSchema,
});

export const refundRequestIntentSchema = z.object({
  intent: z.literal('REFUND_REQUEST'),
  payload: refundRequestPayloadSchema,
  metadata: metadataSchema,
});

export const productRecommendationIntentSchema = z.object({
  intent: z.literal('PRODUCT_RECOMMENDATION'),
  payload: productRecommendationPayloadSchema,
  metadata: metadataSchema,
});

export const policyQaIntentSchema = z.object({
  intent: z.literal('POLICY_QA'),
  payload: policyQaPayloadSchema,
  metadata: metadataSchema,
});

export const buyerIntentSchema = z.discriminatedUnion('intent', [
  refundRequestIntentSchema,
  productRecommendationIntentSchema,
  policyQaIntentSchema,
]);

export type BuyerIntentSchema = z.ZodType<BuyerIntent>;

export const buyerIntentSchemasByType: Record<BuyerIntentType, BuyerIntentSchema> = {
  REFUND_REQUEST: refundRequestIntentSchema,
  PRODUCT_RECOMMENDATION: productRecommendationIntentSchema,
  POLICY_QA: policyQaIntentSchema,
};
