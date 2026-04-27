import { z } from 'zod';
import { Constants } from '@/lib/types/database.types';
import type {
  RefundAIDecision,
  RefundReason,
  RefundStatus,
  RefundType,
} from '@/lib/models/refund.model';

export const DEFAULT_REFUND_PAGE_SIZE = 20;
export const MAX_REFUND_PAGE_SIZE = 100;

export const REFUND_STATUS_VALUES = Constants.public.Enums.refund_status_enum;
export const REFUND_REASON_VALUES = Constants.public.Enums.refund_reason_enum;
export const REFUND_TYPE_VALUES = Constants.public.Enums.refund_type_enum;
export const AI_REFUND_DECISION_VALUES = Constants.public.Enums.ai_refund_decision_enum;

export const refundStatusSchema = z.enum(REFUND_STATUS_VALUES);
export const refundReasonSchema = z.enum(REFUND_REASON_VALUES);
export const refundTypeSchema = z.enum(REFUND_TYPE_VALUES);
export const aiRefundDecisionSchema = z.enum(AI_REFUND_DECISION_VALUES);

const refundItemDTOSchema = z.object({
  product_id: z.string().uuid(),
  order_item_id: z.string().uuid().optional().nullable(),
  quantity: z.coerce.number().int().positive(),
  unit_amount: z.coerce.number().min(0).max(1000000),
  total_amount: z.coerce.number().min(0).max(1000000).optional(),
});

const refundAmountSchema = z.coerce.number().min(0).max(1000000);

export const createRefundDTOSchema = z
  .object({
    order_id: z.string().uuid(),
    order_item_id: z.string().uuid().optional().nullable(),
    refund_type: refundTypeSchema,
    reason_code: refundReasonSchema,
    reason_description: z.string().max(1000).optional(),
    requested_amount: refundAmountSchema,
    return_required: z.boolean().optional().default(false),
    evidence_images: z.array(z.string().url()).max(10).optional(),
    items: z.array(refundItemDTOSchema).max(100).optional(),
    currency: z.string().length(3).optional().default('USD'),
  })
  .superRefine((value, ctx) => {
    if (value.refund_type === 'single_item' && !value.order_item_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'order_item_id is required when refund_type is single_item',
        path: ['order_item_id'],
      });
    }

    if (value.refund_type !== 'full_order' && (!value.items || value.items.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'items are required for partial_order and single_item refunds',
        path: ['items'],
      });
    }
  });

export const refundStatusTransitionSchema = z.discriminatedUnion('to', [
  z.object({
    from: refundStatusSchema,
    to: z.literal('approved'),
    processing_notes: z.string().max(2000).optional(),
  }),
  z.object({
    from: refundStatusSchema,
    to: z.literal('rejected'),
    processing_notes: z.string().min(1).max(2000),
  }),
  z.object({
    from: refundStatusSchema,
    to: z.literal('processing'),
    processing_notes: z.string().max(2000).optional(),
  }),
  z.object({
    from: refundStatusSchema,
    to: z.literal('completed'),
    refunded_at: z.string().datetime({ offset: true }),
    payment_reference: z.string().max(120).optional().nullable(),
  }),
  z.object({
    from: refundStatusSchema,
    to: z.literal('cancelled'),
    processing_notes: z.string().max(2000).optional(),
  }),
]);

export const updateRefundDTOSchema = z
  .object({
    status: refundStatusSchema.optional(),
    status_transition: refundStatusTransitionSchema.optional(),
    refund_amount: refundAmountSchema.optional(),
    processing_notes: z.string().max(2000).optional().nullable(),
    payment_reference: z.string().max(120).optional().nullable(),
    return_tracking: z.string().max(120).optional().nullable(),
    return_received_at: z.string().datetime({ offset: true }).optional().nullable(),
    refunded_at: z.string().datetime({ offset: true }).optional().nullable(),
    processed_at: z.string().datetime({ offset: true }).optional().nullable(),
    processed_by: z.string().uuid().optional().nullable(),
    ai_recommendation: aiRefundDecisionSchema.optional().nullable(),
    ai_risk_score: z.number().min(0).max(1).optional().nullable(),
    ai_analysis: z.record(z.string(), z.unknown()).optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.status && value.status_transition) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Use either status or status_transition, not both',
        path: ['status_transition'],
      });
    }
  });

const decisionNotesSchema = z.string().trim().max(1800);

export const approveRefundDecisionDTOSchema = z.object({
  processing_notes: decisionNotesSchema.optional(),
});

export const rejectRefundDecisionDTOSchema = z.object({
  processing_notes: decisionNotesSchema.min(1),
});

export const reviewRefundDecisionDTOSchema = z.object({
  processing_notes: decisionNotesSchema.optional(),
});

export const REFUND_SORT_VALUES = ['recent', 'oldest', 'amount_high', 'amount_low'] as const;
export const refundSortSchema = z.enum(REFUND_SORT_VALUES);

export const refundFilterDTOSchema = z
  .object({
    page: z.coerce.number().int().positive().optional().default(1),
    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_REFUND_PAGE_SIZE)
      .optional()
      .default(DEFAULT_REFUND_PAGE_SIZE),
    status: refundStatusSchema.optional(),
    reason_code: refundReasonSchema.optional(),
    refund_type: refundTypeSchema.optional(),
    buyer_id: z.string().uuid().optional(),
    seller_id: z.string().uuid().optional(),
    order_id: z.string().uuid().optional(),
    order_item_id: z.string().uuid().optional(),
    processed_by: z.string().uuid().optional(),
    dateFrom: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    dateTo: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    sortBy: refundSortSchema.optional().default('recent'),
  })
  .superRefine((value, ctx) => {
    if (value.dateFrom && value.dateTo) {
      const from = new Date(value.dateFrom);
      const to = new Date(value.dateTo);

      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Invalid date range',
          path: ['dateFrom'],
        });
      } else if (from.getTime() > to.getTime()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'dateFrom must be on or before dateTo',
          path: ['dateFrom'],
        });
      }
    }
  });

export type CreateRefundDTO = z.infer<typeof createRefundDTOSchema>;
export type UpdateRefundDTO = z.infer<typeof updateRefundDTOSchema>;
export type RefundStatusTransitionDTO = z.infer<typeof refundStatusTransitionSchema>;
export type RefundFilterDTO = z.infer<typeof refundFilterDTOSchema>;
export type RefundRepositoryFilterDTO = RefundFilterDTO & {
  buyer_id?: string;
  seller_id?: string;
};
export type RefundSortBy = z.infer<typeof refundSortSchema>;
export type ApproveRefundDecisionDTO = z.infer<typeof approveRefundDecisionDTOSchema>;
export type RejectRefundDecisionDTO = z.infer<typeof rejectRefundDecisionDTOSchema>;
export type ReviewRefundDecisionDTO = z.infer<typeof reviewRefundDecisionDTOSchema>;

export interface RefundItemDTO {
  product_id: string;
  order_item_id: string | null;
  quantity: number;
  unit_amount: number;
  total_amount: number;
}

export interface RefundSummaryDTO {
  refund_id: string;
  refund_number: string;
  order_id: string;
  user_id: string;
  buyer_name?: string | null;
  status: RefundStatus;
  reason_code: RefundReason;
  refund_type: RefundType;
  requested_amount: number;
  refund_amount: number;
  created_at: string;
  updated_at: string;
  reason_description?: string | null;
  ai_recommendation?: RefundAIDecision | null;
  ai_risk_score?: number | null;
}

export interface RefundResponseDTO extends RefundSummaryDTO {
  order_item_id: string | null;
  reason_description: string | null;
  return_required: boolean;
  return_tracking: string | null;
  return_received_at: string | null;
  payment_reference: string | null;
  processed_by: string | null;
  processed_at: string | null;
  processing_notes: string | null;
  refunded_at: string | null;
  ai_recommendation: RefundAIDecision | null;
  ai_risk_score: number | null;
  ai_processed_at: string | null;
  evidence_images: string[];
  items: RefundItemDTO[];
}

export interface RefundDetailDTO extends RefundSummaryDTO {
  order_item_id: string | null;
  buyer: {
    user_id: string;
    full_name: string | null;
    email: string | null;
  };
  seller: {
    user_id: string;
    full_name: string | null;
    email: string | null;
  } | null;
  order: {
    order_id: string;
    order_number: string;
    created_at: string;
    currency: string;
    total_amount: number;
  };
  items: RefundItemDTO[];
  reason_description: string | null;
  processing_notes: string | null;
  ai_recommendation: RefundAIDecision | null;
  ai_risk_score: number | null;
  ai_processed_at: string | null;
  return_required: boolean;
  return_tracking: string | null;
  return_received_at: string | null;
  refunded_at: string | null;
}

export interface RefundPaginationDTO {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface RefundListResponseDTO {
  refunds: RefundSummaryDTO[];
  pagination: RefundPaginationDTO;
}
