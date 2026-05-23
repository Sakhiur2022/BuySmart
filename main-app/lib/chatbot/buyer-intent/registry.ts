import type { ZodType } from 'zod';

import type { BuyerIntent, BuyerIntentType } from '@/lib/chatbot/buyer-intent/types';
import { buyerIntentSchemasByType } from '@/lib/chatbot/buyer-intent/schemas';

export type BuyerIntentSchemaRegistry = Map<BuyerIntentType, ZodType<BuyerIntent>>;

const registry: BuyerIntentSchemaRegistry = new Map();
let registryInitialized = false;

function registerDefaults(): void {
  if (registryInitialized) {
    return;
  }

  (
    Object.entries(buyerIntentSchemasByType) as Array<[BuyerIntentType, ZodType<BuyerIntent>]>
  ).forEach(([intentType, schema]) => {
    registry.set(intentType, schema);
  });

  registryInitialized = true;
}

export function getBuyerIntentSchemaRegistry(): BuyerIntentSchemaRegistry {
  registerDefaults();
  return registry;
}

export function getBuyerIntentSchema(
  intentType: BuyerIntentType,
): ZodType<BuyerIntent> | undefined {
  return getBuyerIntentSchemaRegistry().get(intentType);
}
