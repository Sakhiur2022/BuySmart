import type { ZodType } from 'zod';
import type { SellerIntent, SellerIntentType } from '@/lib/chatbot/seller-intent/schemas';
import { sellerIntentSchemasByType } from '@/lib/chatbot/seller-intent/schemas';

export type SellerIntentSchemaRegistry = Map<SellerIntentType, ZodType<SellerIntent>>;

const registry: SellerIntentSchemaRegistry = new Map();
let initialized = false;
function registerDefaults() {
  if (initialized) return;
  (
    Object.entries(sellerIntentSchemasByType) as Array<[SellerIntentType, ZodType<SellerIntent>]>
  ).forEach(([type, schema]) => {
    registry.set(type, schema);
  });
  initialized = true;
}
export function getSellerIntentSchemaRegistry(): SellerIntentSchemaRegistry {
  registerDefaults();
  return registry;
}
export function getSellerIntentSchema(
  intentType: SellerIntentType,
): ZodType<SellerIntent> | undefined {
  return getSellerIntentSchemaRegistry().get(intentType);
}
