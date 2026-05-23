import type { BuyerIntent, BuyerIntentType } from '@/lib/chatbot/buyer-intent/types';
import type { BuyerIntentResult } from '@/lib/chatbot/buyer-intent/errors';
import { validateBuyerIntentOutput } from '@/lib/chatbot/buyer-intent/validation';
import { BuyerIntentPayloadAdapter } from '@/lib/chatbot/buyer-intent/adapter';
import { BuyerIntentToolFactory } from '@/lib/chatbot/buyer-intent/tool-factory';
import type {
  PolicyQaToolInput,
  RecommendationToolInput,
  RefundRequestToolInput,
} from '@/lib/chatbot/buyer-intent/tool-factory';
import type { RecommendationAdapterContext } from '@/lib/chatbot/buyer-intent/adapter';
import type { IntentValidationEventEmitter } from '@/lib/chatbot/buyer-intent/events';
import type { IntentResolutionStrategyRegistry } from '@/lib/chatbot/buyer-intent/strategies';
import { createBuyerIntentStrategyRegistry } from '@/lib/chatbot/buyer-intent/intent-strategies';

export type BuyerToolCall = {
  intent: BuyerIntent;
  toolName: string;
  input: RefundRequestToolInput | RecommendationToolInput | PolicyQaToolInput;
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
    const toolResult = this.toolFactory.getTool(intent.intent);
    if (!toolResult.success) {
      return toolResult;
    }

    const tool = toolResult.value;
    const adapterResult = this.toToolInput(intent, context);

    if (!adapterResult.success) {
      return adapterResult;
    }

    return {
      success: true,
      value: {
        intent,
        toolName: tool.name,
        input: adapterResult.value,
      },
    };
  }

  private toToolInput(
    intent: BuyerIntent,
    context?: RecommendationAdapterContext,
  ): BuyerIntentResult<RefundRequestToolInput | RecommendationToolInput | PolicyQaToolInput> {
    switch (intent.intent) {
      case 'REFUND_REQUEST':
        return this.adapter.toRefundRequestInput(intent.payload);
      case 'PRODUCT_RECOMMENDATION':
        return this.adapter.toRecommendationInput(intent.payload, context ?? { candidates: [] });
      case 'POLICY_QA':
        return this.adapter.toPolicyQaInput(intent.payload);
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
