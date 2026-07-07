import { sellerIntentSchema } from './schemas';
import { SellerIntentPayloadAdapterImpl } from './adapter';
import { SellerIntentToolFactory } from './tool-factory';
import type { SellerIntent } from './schemas';
import type { SellerIntentResult } from './errors';
import { createSellerIntentStrategyRegistry } from './intent-strategies';

export type SellerToolCall = { intent: SellerIntent; toolName: string; input: unknown };

export class SellerChatToolsFacade {
  private readonly adapter = new SellerIntentPayloadAdapterImpl();
  private readonly toolFactory = new SellerIntentToolFactory();
  private readonly strategyRegistry = createSellerIntentStrategyRegistry();

  resolveIntent(raw: unknown): SellerIntentResult<SellerIntent> {
    const parsed = sellerIntentSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: { code: 'INVALID_PAYLOAD', message: parsed.error.message } };
    }

    // Use strategy to further normalize if needed
    const strategy = this.strategyRegistry.get(parsed.data.intent);
    if (!strategy) {
      return {
        success: false,
        error: { code: 'INVALID_INTENT', message: 'No strategy for intent' },
      };
    }

    return strategy.resolve(parsed.data);
  }

  buildToolCall(intent: SellerIntent): SellerIntentResult<SellerToolCall> {
    switch (intent.intent) {
      case 'SELLER_SALES_SUMMARY': {
        const adapterResult = this.adapter.toSalesSummaryInput(intent);
        if (!adapterResult.success) return adapterResult;
        const toolResult = this.toolFactory.getToolByName(adapterResult.value.toolName);
        if (!toolResult.success) return { success: false, error: toolResult.error };
        return {
          success: true,
          value: { intent, toolName: toolResult.value.name, input: adapterResult.value.input },
        };
      }
      case 'SELLER_LISTING_CREATE': {
        const adapterResult = this.adapter.toListingCreateInput(intent);
        if (!adapterResult.success) return adapterResult;
        const toolResult = this.toolFactory.getToolByName(adapterResult.value.toolName);
        if (!toolResult.success) return { success: false, error: toolResult.error };
        return {
          success: true,
          value: { intent, toolName: toolResult.value.name, input: adapterResult.value.input },
        };
      }
      default:
        return { success: false, error: { code: 'TOOL_NOT_FOUND', message: 'No tool for intent' } };
    }
  }
}
