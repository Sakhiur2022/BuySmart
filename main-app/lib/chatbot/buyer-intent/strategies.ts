import type {
  BuyerIntent,
  BuyerIntentType,
  RawBuyerIntentOutput,
} from '@/lib/chatbot/buyer-intent/types';
import type { BuyerIntentResult } from '@/lib/chatbot/buyer-intent/errors';

export interface IntentResolutionStrategy<TIntent extends BuyerIntent = BuyerIntent> {
  readonly intentType: BuyerIntentType;
  resolve(input: RawBuyerIntentOutput): BuyerIntentResult<TIntent>;
}

export type IntentResolutionStrategyRegistry = Map<
  BuyerIntentType,
  IntentResolutionStrategy<BuyerIntent>
>;

export function getIntentResolutionStrategy(
  registry: IntentResolutionStrategyRegistry,
  intentType: BuyerIntentType,
): IntentResolutionStrategy<BuyerIntent> | undefined {
  return registry.get(intentType);
}
