import type { RefundReason } from '@/lib/models/refund.model';
import type {
  ProductRecommendationPayload,
  PolicyQaPayload,
  RefundRequestPayload,
} from '@/lib/chatbot/buyer-intent/types';
import type { BuyerIntentResult } from '@/lib/chatbot/buyer-intent/errors';
import type {
  PolicyQaToolInput,
  RecommendationToolInput,
  RefundRequestToolInput,
} from '@/lib/chatbot/buyer-intent/tool-factory';

const refundReasonMap: Record<string, RefundReason> = {
  damage: 'damaged',
  non_delivery: 'late_delivery',
  wrong_item: 'wrong_item',
  other: 'other',
};

export type RecommendationAdapterContext = {
  candidates: RecommendationToolInput['candidates'];
  contextSummary?: string;
  maxResults?: number;
};

export class BuyerIntentPayloadAdapter {
  toRefundOrderFetchInput(payload: RefundRequestPayload): BuyerIntentResult<{
    orderSignal?: RefundRequestPayload['orderSignal'];
  }> {
    const orderSignal = payload.orderSignal;

    if (!orderSignal) {
      return {
        success: false,
        error: {
          code: 'ADAPTER_ERROR',
          message: 'Order information is required before fetching orders.',
          fieldPath: ['orderSignal'],
        },
      };
    }

    return {
      success: true,
      value: {
        orderSignal,
      },
    };
  }

  toRefundRequestInput(payload: RefundRequestPayload): BuyerIntentResult<RefundRequestToolInput> {
    const orderId = payload.orderSignal?.orderId?.trim();
    if (!orderId) {
      return {
        success: false,
        error: {
          code: 'ADAPTER_ERROR',
          message: 'Order id is required before submitting a refund request.',
          fieldPath: ['orderSignal', 'orderId'],
        },
      };
    }

    if (!payload.reason) {
      return {
        success: false,
        error: {
          code: 'ADAPTER_ERROR',
          message: 'Refund reason is required before submitting a refund request.',
          fieldPath: ['reason'],
        },
      };
    }

    if (!payload.requestedAmount) {
      return {
        success: false,
        error: {
          code: 'ADAPTER_ERROR',
          message: 'Refund amount is required before submitting a refund request.',
          fieldPath: ['requestedAmount'],
        },
      };
    }

    const mappedReason = refundReasonMap[payload.reason];
    if (!mappedReason) {
      return {
        success: false,
        error: {
          code: 'ADAPTER_ERROR',
          message: 'Refund reason is not supported.',
          fieldPath: ['reason'],
        },
      };
    }

    const items = payload.items?.map((item) => ({
      product_id: item.productId,
      order_item_id: item.orderItemId ?? null,
      quantity: item.quantity,
      unit_amount: item.unitAmount,
      total_amount: item.totalAmount,
    }));

    let refundType: RefundRequestToolInput['refund_type'] = 'full_order';
    let orderItemId: string | null | undefined = null;

    if (items && items.length > 0) {
      const singleItem = items.length === 1 ? items[0] : null;
      if (singleItem?.order_item_id) {
        refundType = 'single_item';
        orderItemId = singleItem.order_item_id;
      } else {
        refundType = 'partial_order';
      }
    }

    return {
      success: true,
      value: {
        order_id: orderId,
        order_item_id: orderItemId ?? undefined,
        refund_type: refundType,
        reason_code: mappedReason,
        reason_description: payload.reasonDescription?.trim() || undefined,
        requested_amount: payload.requestedAmount,
        return_required: false,
        evidence_images: payload.evidenceImages,
        items,
        currency: payload.currency ?? 'USD',
      },
    };
  }

  toRecommendationInput(
    payload: ProductRecommendationPayload,
    context: RecommendationAdapterContext,
  ): BuyerIntentResult<RecommendationToolInput> {
    if (!context.candidates || context.candidates.length === 0) {
      return {
        success: false,
        error: {
          code: 'ADAPTER_ERROR',
          message: 'Recommendation candidates are required before requesting recommendations.',
          fieldPath: ['candidates'],
        },
      };
    }

    return {
      success: true,
      value: {
        userIntent:
          [payload.occasion, payload.category, ...(payload.attributes ?? [])]
            .filter((value) => typeof value === 'string' && value.trim().length > 0)
            .join(', ')
            .trim() || 'Product recommendations',
        contextSummary: context.contextSummary,
        candidates: context.candidates,
        constraints: {
          budgetMin: payload.budget?.min,
          budgetMax: payload.budget?.max,
          maxResults: context.maxResults,
        },
      },
    };
  }

  toPolicyQaInput(payload: PolicyQaPayload): BuyerIntentResult<PolicyQaToolInput> {
    if (!payload.question?.trim()) {
      return {
        success: false,
        error: {
          code: 'ADAPTER_ERROR',
          message: 'Policy question is required before requesting an answer.',
          fieldPath: ['question'],
        },
      };
    }

    return {
      success: true,
      value: {
        question: payload.question.trim(),
        domain: payload.domain,
        confidence: payload.confidence,
      },
    };
  }
}
