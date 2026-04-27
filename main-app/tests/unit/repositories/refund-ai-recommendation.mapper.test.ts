import { describe, expect, it } from 'vitest';

import {
  mapRecommendationToPersistence,
  maskRefundSummaryForRole,
} from '@/lib/repositories/refund-ai-recommendation.mapper';

describe('refund-ai-recommendation mapper', () => {
  it('maps recommendation output to repository persistence shape', () => {
    const result = mapRecommendationToPersistence({
      schemaVersion: 'ai24.v1',
      recommendation: 'auto_reject',
      riskScore: 0.93421,
      confidenceScore: 0.81111,
      reasoning: 'High-risk fraud-like signal profile.',
      signals: [{ code: 'very_high_value_item', weight: 0.8 }],
      modelMetadata: {
        provider: 'groq',
        model: 'mixtral-test',
        fallbackUsed: false,
        generatedAt: '2026-04-27T00:00:00.000Z',
      },
    });

    expect(result.aiRecommendation).toBe('auto_reject');
    expect(result.aiRiskScore).toBe(0.9342);
    expect(result.aiAnalysis.schema_version).toBe('ai24.v1');
  });

  it('masks reasoning fields for non-admin views', () => {
    const masked = maskRefundSummaryForRole(
      {
        refund_id: 'ref-1',
        refund_number: 'RFD-1',
        order_id: 'order-1',
        user_id: 'buyer-1',
        status: 'pending',
        reason_code: 'damaged',
        refund_type: 'full_order',
        requested_amount: 20,
        refund_amount: 20,
        created_at: '2026-04-27T00:00:00.000Z',
        updated_at: '2026-04-27T00:00:00.000Z',
        ai_recommendation: 'manual_review',
        ai_risk_score: 0.5,
        ai_processed_at: '2026-04-27T00:00:00.000Z',
        ai_analysis: {
          notes: 'hidden',
          signals: [{ code: 'signal' }],
          confidence: 0.8,
        },
      },
      'buyer',
    );

    expect(masked.ai_analysis).toEqual({ confidence: 0.8 });
  });
});
