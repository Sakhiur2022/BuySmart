import type { SellerIntent, SellerIntentType } from './schemas';
import type { SellerIntentResult } from './errors.ts';

function toIntent(raw: unknown): SellerIntentResult<SellerIntent> {
  if (
    !raw ||
    typeof raw !== 'object' ||
    typeof (raw as Record<string, unknown>).intent !== 'string'
  ) {
    return {
      success: false,
      error: { code: 'INVALID_PAYLOAD', message: 'Intent payload must include an intent type.' },
    };
  }

  return { success: true, value: raw as SellerIntent };
}

export interface IntentResolutionStrategy<T> {
  intentType: SellerIntentType;
  resolve(input: unknown): SellerIntentResult<T>;
}

export class SalesSummaryStrategy implements IntentResolutionStrategy<SellerIntent> {
  intentType: SellerIntentType = 'SELLER_SALES_SUMMARY';

  resolve(input: unknown): SellerIntentResult<SellerIntent> {
    const parsed = toIntent(input);
    if (!parsed.success) return parsed;
    if (parsed.value.intent !== this.intentType) {
      return {
        success: false,
        error: { code: 'INVALID_PAYLOAD', message: 'Intent type mismatch' },
      };
    }
    return { success: true, value: parsed.value };
  }
}

export class ListingCreateStrategy implements IntentResolutionStrategy<SellerIntent> {
  intentType: SellerIntentType = 'SELLER_LISTING_CREATE';

  resolve(input: unknown): SellerIntentResult<SellerIntent> {
    const parsed = toIntent(input);
    if (!parsed.success) return parsed;
    if (parsed.value.intent !== this.intentType) {
      return {
        success: false,
        error: { code: 'INVALID_PAYLOAD', message: 'Intent type mismatch' },
      };
    }
    const intent = parsed.value;
    // Basic validation: ensure payload has required fields
    const payload = (intent as unknown as { payload?: Record<string, unknown> }).payload || {};
    if (!payload || typeof payload.name !== 'string') {
      return {
        success: false,
        error: { code: 'INVALID_PAYLOAD', message: 'Missing product name' },
      };
    }
    return { success: true, value: intent };
  }
}

export function createSellerIntentStrategyRegistry() {
  return new Map<SellerIntentType, IntentResolutionStrategy<SellerIntent>>([
    ['SELLER_SALES_SUMMARY', new SalesSummaryStrategy()],
    ['SELLER_LISTING_CREATE', new ListingCreateStrategy()],
  ]);
}
