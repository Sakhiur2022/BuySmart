import type {
  BuyerIntent,
  BuyerIntentType,
  PolicyQaIntent,
  ProductRecommendationIntent,
  RefundRequestIntent,
  RawBuyerIntentOutput,
} from '@/lib/chatbot/buyer-intent/types';
import type { BuyerIntentResult } from '@/lib/chatbot/buyer-intent/errors';
import type { IntentResolutionStrategy } from '@/lib/chatbot/buyer-intent/strategies';

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function toIntent(input: RawBuyerIntentOutput): BuyerIntentResult<BuyerIntent> {
  if (!input || typeof input !== 'object' || typeof input.intent !== 'string') {
    return {
      success: false,
      error: {
        code: 'INVALID_PAYLOAD',
        message: 'Intent payload must include an intent type.',
      },
    };
  }

  return { success: true, value: input as BuyerIntent };
}

export class RefundIntentStrategy implements IntentResolutionStrategy<RefundRequestIntent> {
  readonly intentType: BuyerIntentType = 'REFUND_REQUEST';

  resolve(input: RawBuyerIntentOutput): BuyerIntentResult<RefundRequestIntent> {
    const parsed = toIntent(input);
    if (!parsed.success) {
      return parsed;
    }

    if (parsed.value.intent !== this.intentType) {
      return {
        success: false,
        error: {
          code: 'INVALID_PAYLOAD',
          message: 'Refund intent payload type mismatch.',
        },
      };
    }

    const intent = parsed.value as RefundRequestIntent;
    const payload = { ...intent.payload };
    const normalizedDescription = payload.reasonDescription
      ? normalizeWhitespace(payload.reasonDescription)
      : undefined;

    const normalizedImages = payload.evidenceImages?.filter((url) => Boolean(url && url.trim()));

    const normalized: RefundRequestIntent = {
      ...intent,
      payload: {
        ...payload,
        reasonDescription: normalizedDescription,
        evidenceImages: normalizedImages,
        currency: payload.currency?.toUpperCase() ?? payload.currency,
      },
      metadata: {
        ...intent.metadata,
        isPartial:
          intent.metadata?.isPartial ??
          (!payload.orderSignal?.orderId || !payload.reason || !payload.requestedAmount),
      },
    };

    return { success: true, value: normalized };
  }
}

export class RecommendationIntentStrategy implements IntentResolutionStrategy<ProductRecommendationIntent> {
  readonly intentType: BuyerIntentType = 'PRODUCT_RECOMMENDATION';

  resolve(input: RawBuyerIntentOutput): BuyerIntentResult<ProductRecommendationIntent> {
    const parsed = toIntent(input);
    if (!parsed.success) {
      return parsed;
    }

    if (parsed.value.intent !== this.intentType) {
      return {
        success: false,
        error: {
          code: 'INVALID_PAYLOAD',
          message: 'Recommendation intent payload type mismatch.',
        },
      };
    }

    const intent = parsed.value as ProductRecommendationIntent;
    const payload = { ...intent.payload };
    const normalizedAttributes = payload.attributes
      ?.map((attr) => normalizeWhitespace(attr))
      .filter((attr) => attr.length > 0);

    const normalized: ProductRecommendationIntent = {
      ...intent,
      payload: {
        ...payload,
        attributes: normalizedAttributes,
        budget: payload.budget
          ? {
              ...payload.budget,
              currency: payload.budget.currency?.toUpperCase() ?? payload.budget.currency,
            }
          : payload.budget,
      },
    };

    return { success: true, value: normalized };
  }
}

export class PolicyQaIntentStrategy implements IntentResolutionStrategy<PolicyQaIntent> {
  readonly intentType: BuyerIntentType = 'POLICY_QA';

  resolve(input: RawBuyerIntentOutput): BuyerIntentResult<PolicyQaIntent> {
    const parsed = toIntent(input);
    if (!parsed.success) {
      return parsed;
    }

    if (parsed.value.intent !== this.intentType) {
      return {
        success: false,
        error: {
          code: 'INVALID_PAYLOAD',
          message: 'Policy QA intent payload type mismatch.',
        },
      };
    }

    const intent = parsed.value as PolicyQaIntent;
    const payload = { ...intent.payload };
    const normalizedQuestion = normalizeWhitespace(payload.question || '');
    if (!normalizedQuestion) {
      return {
        success: false,
        error: {
          code: 'INVALID_PAYLOAD',
          message: 'Policy QA requires a question string.',
          fieldPath: ['question'],
        },
      };
    }

    return {
      success: true,
      value: {
        ...intent,
        payload: {
          ...payload,
          question: normalizedQuestion,
        },
      },
    };
  }
}

export function createBuyerIntentStrategyRegistry() {
  return new Map<BuyerIntentType, IntentResolutionStrategy<BuyerIntent>>([
    ['REFUND_REQUEST', new RefundIntentStrategy() as IntentResolutionStrategy<BuyerIntent>],
    [
      'PRODUCT_RECOMMENDATION',
      new RecommendationIntentStrategy() as IntentResolutionStrategy<BuyerIntent>,
    ],
    ['POLICY_QA', new PolicyQaIntentStrategy() as IntentResolutionStrategy<BuyerIntent>],
  ]);
}
