'use client';

/**
 * Compatibility wrapper that renders the full RecommendationPanel UI
 * (intent/chat input, budget range, and result controls) in sidebar slots.
 */

import type { ProductCandidate } from '@/lib/agents/recommendation/types';

import { RecommendationPanel } from '@/components/recommendations/recommendation-panel';

export interface RecommendationSidebarProduct {
  productId: string;
  name: string;
  price: number;
  image?: string | null;
  shortDescription?: string | null;
}

interface RecommendationSidebarProps {
  isAuthenticated: boolean;
  userEmail?: string | null;
  userDisplayName?: string;
  candidates: ProductCandidate[];
  products?: RecommendationSidebarProduct[];
}

export function RecommendationSidebar({
  isAuthenticated,
  userEmail,
  userDisplayName,
  candidates,
}: RecommendationSidebarProps) {
  return (
    <aside
      aria-label="Product recommendations"
      className="w-full lg:sticky lg:top-20 lg:h-[calc(100vh-5rem)]"
    >
      <RecommendationPanel
        isAuthenticated={isAuthenticated}
        userEmail={userEmail}
        userDisplayName={userDisplayName}
        candidates={candidates}
        compact
      />
    </aside>
  );
}
