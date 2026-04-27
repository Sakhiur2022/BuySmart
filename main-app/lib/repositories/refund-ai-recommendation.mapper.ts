import type { Database } from '@/lib/types/database.types';
import type { RefundDetailDTO, RefundSummaryDTO } from '@/lib/types/refund.types';
import type { RefundDecisionOutput } from '@/lib/agents/refund/types';

type UserRole = Database['public']['Enums']['user_role_enum'];

export function mapRecommendationToPersistence(input: RefundDecisionOutput): {
  aiRecommendation: Database['public']['Enums']['ai_refund_decision_enum'];
  aiRiskScore: number;
  aiAnalysis: Record<string, unknown>;
  aiProcessedAt: string;
} {
  return {
    aiRecommendation: input.recommendation,
    aiRiskScore: Number(input.riskScore.toFixed(4)),
    aiAnalysis: {
      recommendation: input.recommendation,
      risk_score: Number(input.riskScore.toFixed(4)),
      confidence: Number(input.confidenceScore.toFixed(4)),
      notes: input.reasoning,
      signals: input.signals,
      schema_version: input.schemaVersion,
      model_metadata: input.modelMetadata,
    },
    aiProcessedAt: input.modelMetadata.generatedAt,
  };
}

function removeReasoning(
  analysis: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!analysis || typeof analysis !== 'object' || Array.isArray(analysis)) {
    return null;
  }

  const next = { ...analysis };
  delete next.notes;
  delete next.signals;

  return next;
}

export function maskRefundSummaryForRole<T extends RefundSummaryDTO>(refund: T, role: UserRole): T {
  if (role === 'admin') {
    return refund;
  }

  return {
    ...refund,
    ai_analysis: removeReasoning(refund.ai_analysis),
  };
}

export function maskRefundDetailForRole<T extends RefundDetailDTO>(refund: T, role: UserRole): T {
  if (role === 'admin') {
    return refund;
  }

  return {
    ...refund,
    ai_analysis: removeReasoning(refund.ai_analysis),
  };
}
