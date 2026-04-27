import type { RefundAIDecision, RefundReason } from '@/lib/models/refund.model';
import type { RefundResponseDTO, RefundSummaryDTO } from '@/lib/types/refund.types';
import type { IRefundRepository } from '@/lib/repositories/refund.repository';

type RefundAIAnalysis = {
  recommendation: RefundAIDecision;
  riskScore: number;
  confidence: number;
  factors: string[];
  notes: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function pushFactor(factors: string[], factor: string): void {
  if (!factors.includes(factor)) {
    factors.push(factor);
  }
}

function buildBaseRisk(reasonCode: RefundReason): number {
  switch (reasonCode) {
    case 'changed_mind':
      return 0.28;
    case 'duplicate_order':
      return 0.18;
    case 'late_delivery':
      return 0.22;
    case 'damaged':
    case 'defective':
    case 'wrong_item':
    case 'not_as_described':
      return 0.42;
    case 'size_issue':
      return 0.36;
    case 'other':
      return 0.5;
    default:
      return 0.45;
  }
}

function analyzeRefund(input: {
  reasonCode: RefundReason;
  reasonDescription: string | null | undefined;
  requestedAmount: number;
}): RefundAIAnalysis {
  const factors: string[] = [];
  const normalizedDescription = input.reasonDescription?.trim().toLowerCase() ?? '';
  let riskScore = buildBaseRisk(input.reasonCode);

  if (input.requestedAmount >= 10000) {
    riskScore += 0.28;
    pushFactor(factors, 'very_high_value_item');
  } else if (input.requestedAmount >= 5000) {
    riskScore += 0.2;
    pushFactor(factors, 'high_value_item');
  } else if (input.requestedAmount >= 1000) {
    riskScore += 0.1;
    pushFactor(factors, 'mid_value_item');
  } else {
    riskScore -= 0.08;
    pushFactor(factors, 'low_value_item');
  }

  if (normalizedDescription.length < 20) {
    riskScore += 0.08;
    pushFactor(factors, 'limited_detail');
  } else {
    pushFactor(factors, 'detailed_reason_provided');
  }

  if (/photo|photos|image|images|evidence|damaged|scratch|dent/.test(normalizedDescription)) {
    riskScore -= 0.08;
    pushFactor(factors, 'supporting_evidence_mentioned');
  }

  if (/don't want|dont want|changed my mind|anymore/.test(normalizedDescription)) {
    pushFactor(factors, 'buyer_remorse_signal');
  }

  riskScore = clamp(Number(riskScore.toFixed(2)), 0.05, 0.95);

  let recommendation: RefundAIDecision = 'manual_review';
  if (riskScore <= 0.2) {
    recommendation = 'auto_approve';
  } else if (riskScore >= 0.8) {
    recommendation = 'auto_reject';
  }

  const confidenceBase = 0.72 + Math.abs(riskScore - 0.5) * 0.35;
  const confidenceBoost = factors.length >= 3 ? 0.04 : 0;
  const confidence = clamp(Number((confidenceBase + confidenceBoost).toFixed(2)), 0.7, 0.96);

  let notes = 'Recommendation: Leave this refund to admin review.';
  if (recommendation === 'auto_approve') {
    notes = 'Recommendation: Auto approve based on low risk indicators and clear buyer-friendly context.';
  } else if (recommendation === 'auto_reject') {
    notes = 'Recommendation: Auto reject based on elevated risk indicators and low refund confidence for buyer claim.';
  } else if (input.requestedAmount >= 5000) {
    notes = 'Recommendation: Manual review due to high item value.';
  }

  if (normalizedDescription.includes('photo') || normalizedDescription.includes('evidence')) {
    notes += ' Customer provided photographic evidence.';
  } else if (normalizedDescription.length >= 20) {
    notes += ' Buyer provided additional context.';
  }

  return {
    recommendation,
    riskScore,
    confidence,
    factors,
    notes,
  };
}

function toPersistedAnalysis(result: RefundAIAnalysis): Record<string, unknown> {
  return {
    recommendation: result.recommendation,
    risk_score: result.riskScore,
    confidence: result.confidence,
    factors: result.factors,
    notes: result.notes,
  };
}

export function enrichRefundSummaryWithAIAnalysis<T extends RefundSummaryDTO>(refund: T): T {
  if (refund.ai_processed_at && refund.ai_analysis) {
    return refund;
  }

  const analysis = analyzeRefund({
    reasonCode: refund.reason_code,
    reasonDescription: refund.reason_description,
    requestedAmount: refund.requested_amount,
  });

  return {
    ...refund,
    ai_recommendation: analysis.recommendation,
    ai_risk_score: analysis.riskScore,
    ai_processed_at: refund.ai_processed_at ?? new Date().toISOString(),
    ai_analysis: toPersistedAnalysis(analysis),
  };
}

export async function analyzeRefundForCreatedRefund(
  refundRepository: IRefundRepository,
  refund: RefundResponseDTO,
): Promise<RefundResponseDTO> {
  const analysis = analyzeRefund({
    reasonCode: refund.reason_code,
    reasonDescription: refund.reason_description,
    requestedAmount: refund.requested_amount,
  });

  const persisted = await refundRepository.saveAIAnalysis({
    refundId: refund.refund_id,
    aiRecommendation: analysis.recommendation,
    aiRiskScore: analysis.riskScore,
    aiAnalysis: toPersistedAnalysis(analysis),
    aiProcessedAt: new Date().toISOString(),
  });

  return persisted ?? {
    ...refund,
    ai_recommendation: analysis.recommendation,
    ai_risk_score: analysis.riskScore,
    ai_processed_at: new Date().toISOString(),
    ai_analysis: toPersistedAnalysis(analysis),
  };
}
