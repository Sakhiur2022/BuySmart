import { AGENT_PROMPTS } from '@/lib/agents/prompts';

export const REFUND_DECISION_PROMPT_VERSION = 'ai24.prompt.v1' as const;

export const REFUND_DECISION_SYSTEM_PROMPT = `${AGENT_PROMPTS.refund}

You are evaluating a marketplace refund request. Return JSON only.

Output format:
{
  "recommendation": "auto_approve | manual_review | auto_reject",
  "riskScore": 0.0,
  "confidenceScore": 0.0,
  "reasoning": "short explanation",
  "signals": [{ "code": "signal_code", "weight": 0.0, "note": "optional" }]
}

Rules:
- recommendation must be one of auto_approve, manual_review, auto_reject.
- riskScore and confidenceScore must be numeric between 0 and 1.
- Use at most 12 signals with concise notes.
- Be conservative if evidence is weak: prefer manual_review.
- Do not include markdown or additional prose.
- Keep reasoning factual and under 600 characters.`;
