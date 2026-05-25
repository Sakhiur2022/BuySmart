import type { BuyerIntent, BuyerIntentType } from '@/lib/chatbot/buyer-intent/types';
import type { BuyerIntentResult } from '@/lib/chatbot/buyer-intent/errors';
import { validateBuyerIntentOutput } from '@/lib/chatbot/buyer-intent/validation';
import { BuyerIntentPayloadAdapter } from '@/lib/chatbot/buyer-intent/adapter';
import { BuyerIntentToolFactory } from '@/lib/chatbot/buyer-intent/tool-factory';
import type {
  PolicyQaToolInput,
  RecommendationToolInput,
  RefundOrderFetchToolInput,
  RefundRequestToolInput,
} from '@/lib/chatbot/buyer-intent/tool-factory';
import type { RecommendationAdapterContext } from '@/lib/chatbot/buyer-intent/adapter';
import type { IntentValidationEventEmitter } from '@/lib/chatbot/buyer-intent/events';
import type { IntentResolutionStrategyRegistry } from '@/lib/chatbot/buyer-intent/strategies';
import { createBuyerIntentStrategyRegistry } from '@/lib/chatbot/buyer-intent/intent-strategies';

export type BuyerToolCall = {
  intent: BuyerIntent;
  toolName: string;
  input:
    | RefundRequestToolInput
    | RefundOrderFetchToolInput
    | RecommendationToolInput
    | PolicyQaToolInput;
};

export class BuyerChatToolsFacade {
  private readonly adapter: BuyerIntentPayloadAdapter;
  private readonly toolFactory: BuyerIntentToolFactory;
  private readonly eventEmitter?: IntentValidationEventEmitter;
  private readonly strategyRegistry: IntentResolutionStrategyRegistry;

  constructor(input?: {
    adapter?: BuyerIntentPayloadAdapter;
    toolFactory?: BuyerIntentToolFactory;
    eventEmitter?: IntentValidationEventEmitter;
    strategyRegistry?: IntentResolutionStrategyRegistry;
  }) {
    this.adapter = input?.adapter ?? new BuyerIntentPayloadAdapter();
    this.toolFactory = input?.toolFactory ?? new BuyerIntentToolFactory();
    this.eventEmitter = input?.eventEmitter;
    this.strategyRegistry = input?.strategyRegistry ?? createBuyerIntentStrategyRegistry();
  }

  resolveIntent(raw: unknown): BuyerIntentResult<BuyerIntent> {
    return validateBuyerIntentOutput(raw, {
      eventEmitter: this.eventEmitter,
      strategyRegistry: this.strategyRegistry,
    });
  }

  buildToolCall(
    intent: BuyerIntent,
    context?: RecommendationAdapterContext,
  ): BuyerIntentResult<BuyerToolCall> {
    const adapterResult = this.toToolInput(intent, context);

    if (!adapterResult.success) {
      return adapterResult;
    }

    const toolName = adapterResult.value.toolName;
    const toolResult = this.toolFactory.getToolByName(toolName);
    if (!toolResult.success) {
      return toolResult;
    }

    const tool = toolResult.value;

    return {
      success: true,
      value: {
        intent,
        toolName: tool.name,
        input: adapterResult.value.input,
      },
    };
  }

  private toToolInput(
    intent: BuyerIntent,
    context?: RecommendationAdapterContext,
  ): BuyerIntentResult<{
    toolName: string;
    input:
      | RefundRequestToolInput
      | RefundOrderFetchToolInput
      | RecommendationToolInput
      | PolicyQaToolInput;
  }> {
    switch (intent.intent) {
      case 'REFUND_REQUEST':
        if (!intent.payload.orderSignal?.orderId || intent.metadata?.isPartial) {
          const orderFetchInput = this.adapter.toRefundOrderFetchInput(intent.payload);
          if (!orderFetchInput.success) {
            return orderFetchInput;
          }

          return {
            success: true,
            value: {
              toolName: 'refund_orders_fetch',
              input: orderFetchInput.value,
            },
          };
        }

        const refundInput = this.adapter.toRefundRequestInput(intent.payload);
        if (!refundInput.success) {
          return refundInput;
        }

        return {
          success: true,
          value: {
            toolName: 'refund_request',
            input: refundInput.value,
          },
        };
      case 'PRODUCT_RECOMMENDATION':
        const recommendationInput = this.adapter.toRecommendationInput(
          intent.payload,
          context ?? { candidates: [] },
        );

        if (!recommendationInput.success) {
          return recommendationInput;
        }

        return {
          success: true,
          value: {
            toolName: 'product_recommendation',
            input: recommendationInput.value,
          },
        };
      case 'POLICY_QA':
        const policyInput = this.adapter.toPolicyQaInput(intent.payload);
        if (!policyInput.success) {
          return policyInput;
        }

        return {
          success: true,
          value: {
            toolName: 'policy_qa',
            input: policyInput.value,
          },
        };
      default:
        return {
          success: false,
          error: {
            code: 'TOOL_NOT_FOUND',
            message: `No adapter registered for intent: ${(intent as { intent: BuyerIntentType }).intent}`,
          },
        };
    }
  }
}
