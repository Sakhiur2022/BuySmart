import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });
config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes('--apply');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pushFactor(factors, factor) {
  if (!factors.includes(factor)) {
    factors.push(factor);
  }
}

function buildBaseRisk(reasonCode) {
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

function analyzeRefundHeuristically(input) {
  const factors = [];
  const normalizedDescription = input.reasonDescription?.trim().toLowerCase() ?? '';
  let riskScore = buildBaseRisk(input.reasonCode);
  const mentionsEvidence =
    /photo|photos|image|images|evidence|damaged|scratch|dent/.test(normalizedDescription);
  const buyerRemorseSignal =
    /don't want|dont want|changed my mind|anymore|no longer want/.test(normalizedDescription);
  const usedOrConsumedSignal =
    /\b(finished|consumed|used|already used|already finished|drank|ate|opened|wore|worn|applied|empty)\b/.test(
      normalizedDescription,
    );

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

  if (mentionsEvidence) {
    riskScore -= 0.08;
    pushFactor(factors, 'supporting_evidence_mentioned');
  }

  if (buyerRemorseSignal) {
    riskScore += 0.18;
    pushFactor(factors, 'buyer_remorse_signal');
  }

  if (usedOrConsumedSignal) {
    riskScore += 0.5;
    pushFactor(factors, 'item_already_consumed_or_used');
  }

  riskScore = clamp(Number(riskScore.toFixed(2)), 0.05, 0.95);

  let recommendation = 'manual_review';
  if (usedOrConsumedSignal) {
    recommendation = 'auto_reject';
    riskScore = Math.max(riskScore, 0.85);
  } else if (riskScore <= 0.2) {
    recommendation = 'auto_approve';
  } else if (riskScore >= 0.8) {
    recommendation = 'auto_reject';
  }

  const confidenceBase = 0.72 + Math.abs(riskScore - 0.5) * 0.35;
  const confidenceBoost = factors.length >= 3 ? 0.04 : 0;
  const confidence = clamp(Number((confidenceBase + confidenceBoost).toFixed(2)), 0.7, 0.96);

  let notes = 'Recommendation: Leave this refund to admin review.';
  if (usedOrConsumedSignal && recommendation === 'auto_reject') {
    notes =
      'Recommendation: Auto reject because the buyer states the item was already consumed or used.';
  } else if (recommendation === 'auto_approve') {
    notes =
      'Recommendation: Auto approve based on low risk indicators and clear buyer-friendly context.';
  } else if (recommendation === 'auto_reject') {
    notes =
      'Recommendation: Auto reject based on elevated risk indicators and low refund confidence for buyer claim.';
  } else if (buyerRemorseSignal) {
    notes = 'Recommendation: Manual review due to buyer-remorse signals in the request.';
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

function toAiAnalysis(result, generatedAt) {
  return {
    recommendation: result.recommendation,
    risk_score: result.riskScore,
    confidence: result.confidence,
    factors: result.factors,
    notes: result.notes,
    schema_version: 'ai24.heuristic.v1',
    model_metadata: {
      provider: 'heuristic',
      model: 'refund-risk-rules-v1',
      fallbackUsed: true,
      generatedAt,
    },
  };
}

function isAutoProcessedRow(refund) {
  if (refund.processed_by) {
    return false;
  }

  if (typeof refund.processing_notes !== 'string' || !refund.processing_notes.trim()) {
    return false;
  }

  try {
    const parsed = JSON.parse(refund.processing_notes);
    return parsed?.source === 'ai';
  } catch {
    return false;
  }
}

function mapRecommendationToStatus(recommendation) {
  switch (recommendation) {
    case 'auto_approve':
      return 'approved';
    case 'auto_reject':
      return 'rejected';
    default:
      return 'pending';
  }
}

function buildProcessingNotes(recommendation) {
  if (recommendation === 'manual_review') {
    return null;
  }

  return JSON.stringify({
    decision: recommendation,
    source: 'ai',
    note:
      recommendation === 'auto_approve'
        ? 'Automatically approved by refund AI.'
        : 'Automatically rejected by refund AI.',
  });
}

function buildUpdatePayload(refund, analysis, generatedAt) {
  const nextStatus = mapRecommendationToStatus(analysis.recommendation);
  const update = {
    ai_recommendation: analysis.recommendation,
    ai_risk_score: analysis.riskScore,
    ai_analysis: toAiAnalysis(analysis, generatedAt),
    ai_processed_at: generatedAt,
  };

  if (refund.status === 'pending' || refund.status === 'manual_review') {
    update.status = nextStatus;
    update.processing_notes = buildProcessingNotes(analysis.recommendation);
    update.processed_at = analysis.recommendation === 'manual_review' ? null : generatedAt;
  } else if (isAutoProcessedRow(refund)) {
    update.status = nextStatus;
    update.processing_notes = buildProcessingNotes(analysis.recommendation);
    update.processed_at = analysis.recommendation === 'manual_review' ? null : generatedAt;
  }

  return update;
}

function summarizeChange(refund, analysis, update) {
  return {
    refund_id: refund.refund_id,
    previous_ai_recommendation: refund.ai_recommendation,
    next_ai_recommendation: analysis.recommendation,
    previous_status: refund.status,
    next_status: update.status ?? refund.status,
    requested_amount: refund.requested_amount,
    reason_code: refund.reason_code,
    reason_description: refund.reason_description,
    factors: analysis.factors,
  };
}

async function main() {
  const { data: refunds, error } = await supabase
    .from('refunds')
    .select(
      'refund_id, status, reason_code, reason_description, requested_amount, ai_recommendation, ai_analysis, ai_processed_at, processing_notes, processed_at, processed_by',
    )
    .not('ai_recommendation', 'is', null);

  if (error) {
    throw error;
  }

  const candidates = refunds ?? [];
  const generatedAt = new Date().toISOString();
  const changes = [];

  for (const refund of candidates) {
    const analysis = analyzeRefundHeuristically({
      reasonCode: refund.reason_code,
      reasonDescription: refund.reason_description,
      requestedAmount: refund.requested_amount,
    });

    const nextStatus = mapRecommendationToStatus(analysis.recommendation);
    const shouldChangeRecommendation = refund.ai_recommendation !== analysis.recommendation;
    const shouldChangeStatus =
      (refund.status === 'pending' || refund.status === 'manual_review' || isAutoProcessedRow(refund)) &&
      refund.status !== nextStatus;

    if (!shouldChangeRecommendation && !shouldChangeStatus) {
      continue;
    }

    const update = buildUpdatePayload(refund, analysis, generatedAt);
    changes.push({
      refund,
      analysis,
      update,
      summary: summarizeChange(refund, analysis, update),
    });
  }

  console.log(`Scanned ${candidates.length} refunds with existing AI decisions.`);
  console.log(`Found ${changes.length} refunds that would be updated by the current refund rules.`);

  if (changes.length > 0) {
    console.log('Sample changes:');
    for (const item of changes.slice(0, 10)) {
      console.log(JSON.stringify(item.summary));
    }
  }

  if (!APPLY) {
    console.log('Dry run only. Re-run with --apply to persist these updates.');
    return;
  }

  let updatedCount = 0;
  for (const item of changes) {
    const { error: updateError } = await supabase
      .from('refunds')
      .update(item.update)
      .eq('refund_id', item.refund.refund_id);

    if (updateError) {
      throw updateError;
    }

    updatedCount += 1;
  }

  console.log(`Updated ${updatedCount} refunds.`);
}

main().catch((error) => {
  console.error('Refund AI backfill failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
