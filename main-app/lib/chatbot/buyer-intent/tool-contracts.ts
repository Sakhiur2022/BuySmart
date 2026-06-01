import { z } from 'zod';

import { refundOrderSignalSchema } from '@/lib/chatbot/buyer-intent/schemas';
import { createRefundDTOSchema, refundStatusSchema } from '@/lib/types/refund.types';

export type ToolContract<TInput, TOutput> = {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  outputSchema: z.ZodType<TOutput>;
};

export class ToolContractBuilder<TInput, TOutput> {
  private nameValue: string | null = null;
  private descriptionValue: string | null = null;
  private inputSchemaValue: z.ZodType<TInput> | null = null;
  private outputSchemaValue: z.ZodType<TOutput> | null = null;

  name(name: string): this {
    this.nameValue = name;
    return this;
  }

  description(description: string): this {
    this.descriptionValue = description;
    return this;
  }

  inputSchema(schema: z.ZodType<TInput>): this {
    this.inputSchemaValue = schema;
    return this;
  }

  outputSchema(schema: z.ZodType<TOutput>): this {
    this.outputSchemaValue = schema;
    return this;
  }

  build(): ToolContract<TInput, TOutput> {
    if (
      !this.nameValue ||
      !this.descriptionValue ||
      !this.inputSchemaValue ||
      !this.outputSchemaValue
    ) {
      throw new Error('ToolContractBuilder is missing required fields');
    }

    return {
      name: this.nameValue,
      description: this.descriptionValue,
      inputSchema: this.inputSchemaValue,
      outputSchema: this.outputSchemaValue,
    };
  }
}

export const recommendationCandidateSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  category_id: z.number().int().nonnegative().optional(),
  brand: z.string().min(1).max(120).optional(),
  price: z.number().nonnegative().optional(),
  image: z.string().max(2048).optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
});

export const recommendationConstraintsSchema = z
  .object({
    budgetMin: z.number().nonnegative().optional(),
    budgetMax: z.number().nonnegative().optional(),
    category_ids: z.array(z.number().int().nonnegative()).max(20).optional(),
    brands: z.array(z.string().min(1).max(120)).max(20).optional(),
    mustHaveTags: z.array(z.string().min(1).max(50)).max(20).optional(),
    excludeProductIds: z.array(z.string().min(1).max(100)).max(50).optional(),
    maxResults: z.number().int().min(1).max(10).optional(),
  })
  .refine(
    (value) =>
      value.budgetMin === undefined ||
      value.budgetMax === undefined ||
      value.budgetMin <= value.budgetMax,
    {
      message: 'budgetMin must be less than or equal to budgetMax',
    },
  );

export const recommendationToolInputSchema = z.object({
  userIntent: z.string().min(3).max(500),
  contextSummary: z.string().max(500).optional(),
  candidates: z.array(recommendationCandidateSchema).min(1).max(100),
  constraints: recommendationConstraintsSchema.optional(),
});

export const recommendationToolOutputSchema = z.object({
  summary: z.string().min(1).max(800),
  recommendations: z
    .array(
      z.object({
        productId: z.string().min(1).max(120).optional(),
        title: z.string().min(1).max(200),
        reason: z.string().min(1).max(600),
        score: z.number().min(0).max(1),
        category_id: z.number().int().nonnegative().optional(),
        price: z.number().nonnegative().optional(),
      }),
    )
    .max(20),
});

export const refundRequestToolInputSchema = createRefundDTOSchema;

export const refundRequestToolOutputSchema = z.object({
  refund: z.object({
    refund_id: z.string().uuid(),
    refund_number: z.string().min(1).max(40),
    order_id: z.string().uuid(),
    status: refundStatusSchema,
    requested_amount: z.number().nonnegative(),
    created_at: z.string().datetime({ offset: true }),
  }),
});

export const refundOrderFetchToolInputSchema = z.object({
  orderSignal: refundOrderSignalSchema.optional(),
});

export const refundOrderCardSchema = z.object({
  order_id: z.string().uuid(),
  order_number: z.string().min(1).max(40).optional().nullable(),
  created_at: z.string().datetime({ offset: true }),
  status: z.string().min(1).max(40),
  total_amount: z.number().nonnegative(),
  currency: z.string().length(3),
  product_name: z.string().min(1).max(200).optional().nullable(),
  thumbnail_url: z.string().url().optional().nullable(),
});

export const refundOrderFetchToolOutputSchema = z.object({
  orders: z.array(refundOrderCardSchema).max(20),
});

export const policyQaToolInputSchema = z.object({
  question: z.string().min(1).max(600),
  domain: z.enum(['returns', 'shipping', 'payments', 'account', 'other']),
  confidence: z.enum(['certain', 'ambiguous']),
});

export const policyQaToolOutputSchema = z.object({
  answer: z.string().min(1).max(1200),
  domain: z.enum(['returns', 'shipping', 'payments', 'account', 'other']),
  citations: z.array(z.string().min(1).max(240)).max(5).optional(),
  confidence: z.number().min(0).max(1).optional(),
});
