export interface ProductCandidate {
  id: string;
  title: string;
  category?: string;
  brand?: string;
  price?: number;
  tags?: string[];
}

export interface RecommendationConstraints {
  budgetMin?: number;
  budgetMax?: number;
  categories?: string[];
  brands?: string[];
  mustHaveTags?: string[];
  excludeProductIds?: string[];
  maxResults?: number;
}

export interface RecommendationPayload {
  userIntent: string;
  contextSummary?: string;
  candidates: ProductCandidate[];
  constraints?: RecommendationConstraints;
}

export interface ProductRecommendation {
  productId?: string;
  title: string;
  reason: string;
  score: number;
  category?: string;
  price?: number;
}

export interface RecommendationResult {
  summary: string;
  recommendations: ProductRecommendation[];
}
