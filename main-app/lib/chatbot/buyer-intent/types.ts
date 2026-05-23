export const BUYER_INTENT_TYPES = [
  'REFUND_REQUEST',
  'PRODUCT_RECOMMENDATION',
  'POLICY_QA',
] as const;

export type BuyerIntentType = (typeof BUYER_INTENT_TYPES)[number];

export type RefundReasonSignal = 'damage' | 'non_delivery' | 'wrong_item' | 'other';
export type RefundEvidenceSignal = 'photo_attached' | 'no_photo' | 'unknown';

export type RefundOrderSignal = {
  orderId?: string;
  recentOrders?: boolean;
  orderDescription?: string;
};

export type RefundItemSignal = {
  productId: string;
  orderItemId?: string | null;
  quantity: number;
  unitAmount: number;
  totalAmount?: number;
};

export type RefundRequestPayload = {
  orderSignal?: RefundOrderSignal;
  reason?: RefundReasonSignal;
  reasonDescription?: string;
  evidence?: RefundEvidenceSignal;
  evidenceImages?: string[];
  requestedAmount?: number;
  currency?: string;
  items?: RefundItemSignal[];
  buyerId?: string;
};

export type RecommendationRecipient = 'self' | 'gift' | 'unknown';

export type RecommendationBudget = {
  min?: number;
  max?: number;
  currency?: string;
};

export type ProductRecommendationPayload = {
  budget?: RecommendationBudget;
  category?: string;
  occasion?: string;
  recipient?: RecommendationRecipient;
  attributes?: string[];
};

export type PolicyDomain = 'returns' | 'shipping' | 'payments' | 'account' | 'other';
export type PolicyConfidence = 'certain' | 'ambiguous';

export type PolicyQaPayload = {
  question: string;
  domain: PolicyDomain;
  confidence: PolicyConfidence;
};

export type BuyerIntentMetadata = {
  confidenceScore?: number;
  isPartial?: boolean;
  source?: string;
};

export type RefundRequestIntent = {
  intent: 'REFUND_REQUEST';
  payload: RefundRequestPayload;
  metadata?: BuyerIntentMetadata;
};

export type ProductRecommendationIntent = {
  intent: 'PRODUCT_RECOMMENDATION';
  payload: ProductRecommendationPayload;
  metadata?: BuyerIntentMetadata;
};

export type PolicyQaIntent = {
  intent: 'POLICY_QA';
  payload: PolicyQaPayload;
  metadata?: BuyerIntentMetadata;
};

export type BuyerIntent = RefundRequestIntent | ProductRecommendationIntent | PolicyQaIntent;

export type RawBuyerIntentOutput = {
  intent?: string;
  payload?: unknown;
  metadata?: unknown;
};
