import { z } from 'zod';

import { AI_REFUND_DECISION_VALUES } from '@/lib/types/refund.types';

export const REFUND_DECISION_SCHEMA_VERSION = 'ai24.v1' as const;

const scoreSchema = z
  .number()
  .min(0)
  .max(1)
  .transform((value) => Number(value.toFixed(4)));

const refundReasonSignalSchema = z.object({
  code: z.string().min(1).max(80),
  weight: z.number().min(-1).max(1).optional(),
  note: z.string().min(1).max(240).optional(),
});

export const refundDecisionInputSchema = z.object({
  refund: z.object({
    refundId: z.string().min(1),
    orderId: z.string().min(1),
    reasonCode: z.string().min(1),
    reasonDescription: z.string().max(1000).nullable(),
    requestedAmount: z.number().positive(),
    createdAt: z.string().datetime({ offset: true }),
    currency: z.string().length(3),
  }),
  order: z.object({
    status: z.string().min(1),
    paymentStatus: z.string().min(1),
    totalAmount: z.number().nonnegative(),
    remainingRefundableAmount: z.number().nonnegative(),
  }),
  buyerHistory: z
    .object({
      totalRefunds: z.number().int().nonnegative().optional(),
      completedRefunds: z.number().int().nonnegative().optional(),
    })
    .optional(),
  sellerHistory: z
    .object({
      disputedOrders: z.number().int().nonnegative().optional(),
      completedOrders: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

export const refundDecisionOutputSchema = z.object({
  schemaVersion: z.literal(REFUND_DECISION_SCHEMA_VERSION),
  recommendation: z.enum(AI_REFUND_DECISION_VALUES),
  riskScore: scoreSchema,
  confidenceScore: scoreSchema,
  reasoning: z.string().min(1).max(600),
  signals: z.array(refundReasonSignalSchema).max(12),
  modelMetadata: z.object({
    provider: z.literal('groq'),
    model: z.string().min(1),
    fallbackUsed: z.boolean().default(false),
    generatedAt: z.string().datetime({ offset: true }),
  }),
});

export type RefundDecisionInput = z.infer<typeof refundDecisionInputSchema>;
export type RefundDecisionOutput = z.infer<typeof refundDecisionOutputSchema>;
export type RefundDecisionSignal = z.infer<typeof refundReasonSignalSchema>;

export const refundDecisionModelPayloadSchema = z.object({
  recommendation: z.enum(AI_REFUND_DECISION_VALUES),
  riskScore: scoreSchema,
  confidenceScore: scoreSchema,
  reasoning: z.string().min(1).max(600),
  signals: z.array(refundReasonSignalSchema).max(12),
});

export type RefundDecisionModelPayload = z.infer<typeof refundDecisionModelPayloadSchema>;
