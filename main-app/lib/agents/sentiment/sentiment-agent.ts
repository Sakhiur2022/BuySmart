import { z } from 'zod';

import { BaseAgent } from '@/lib/agents/base-agent';
import { AGENT_PROMPTS } from '@/lib/agents/prompts';
import type { AgentInput } from '@/lib/agents/types';
import type {
  SentimentAnalysisPayload,
  SentimentAnalysisResult,
} from '@/lib/agents/sentiment/types';

const SENTIMENT_LABELS = ['positive', 'neutral', 'negative', 'mixed'] as const;
const FALLBACK_LABEL = 'neutral';
const FALLBACK_CONFIDENCE = 0;
const FALLBACK_SCORE = 0;
const MAX_REASONING_LENGTH = 300;
const MAX_KEY_SIGNALS = 8;
const NEUTRAL_SCORE = 0;
const MIXED_SCORE = 0;

const responseSchema = z
  .object({
    label: z.enum(SENTIMENT_LABELS).optional(),
    sentiment: z.enum(SENTIMENT_LABELS).optional(),
    score: z.number().min(-1).max(1).optional(),
    confidence: z.number().min(0).max(1).optional(),
    confidenceScore: z.number().min(0).max(1).optional(),
    category: z.enum([
      'product_quality',
      'delivery',
      'customer_service',
      'pricing',
      'user_experience',
      'other',
    ]),
    urgency: z.enum(['low', 'medium', 'high', 'critical']),
    reasoningSummary: z.string().min(1).max(MAX_REASONING_LENGTH),
    keySignals: z.array(z.string().min(1).max(80)).max(8),
  })
  .refine((value) => Boolean(value.label ?? value.sentiment), {
    message: 'Either label or sentiment is required.',
  });

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeConfidence(value: unknown): number {
  return clamp(Number(value ?? FALLBACK_CONFIDENCE), 0, 1);
}

function deriveScoreFromLabel(
  label: (typeof SENTIMENT_LABELS)[number],
  confidence: number,
): number {
  switch (label) {
    case 'positive':
      return confidence;
    case 'negative':
      return -confidence;
    case 'neutral':
      return NEUTRAL_SCORE;
    case 'mixed':
      return MIXED_SCORE;
    default:
      return FALLBACK_SCORE;
  }
}

function normalizeScore(
  label: (typeof SENTIMENT_LABELS)[number],
  score: unknown,
  confidence: number,
): number {
  const hasExplicitScore = Number.isFinite(Number(score));

  if (!hasExplicitScore) {
    return deriveScoreFromLabel(label, confidence);
  }

  const parsedScore = clamp(Number(score), -1, 1);

  if (label === 'positive') {
    return Math.abs(parsedScore);
  }

  if (label === 'negative') {
    return -Math.abs(parsedScore);
  }

  return MIXED_SCORE;
}

export class SentimentAgent extends BaseAgent<SentimentAnalysisPayload, SentimentAnalysisResult> {
  readonly name = 'sentiment';
  readonly version = '1.0.0';
  protected cacheTtlMs = 10 * 60 * 1000;

  protected readonly systemPrompt = `${AGENT_PROMPTS.sentiment}

Return JSON only with this exact structure:
{
  "label": "positive | neutral | negative | mixed",
  "score": -1.0,
  "confidence": 0.0,
  "category": "product_quality | delivery | customer_service | pricing | user_experience | other",
  "urgency": "low | medium | high | critical",
  "reasoningSummary": "brief explanation under 300 chars",
  "keySignals": ["signal 1", "signal 2"]
}

Rules:
- Base sentiment strictly on provided feedback text.
- score must be between -1 and 1.
- confidence must be between 0 and 1.
- reasoningSummary must be concise, factual, and non-sensitive.
- keySignals should be short phrases and include only strongest cues.`;

  protected parseOutput(output: string): SentimentAnalysisResult {
    const parsedFromJson = this.tryParseAsJson(output);
    if (parsedFromJson) {
      return parsedFromJson;
    }

    return {
      label: FALLBACK_LABEL,
      sentiment: FALLBACK_LABEL,
      score: FALLBACK_SCORE,
      confidence: FALLBACK_CONFIDENCE,
      confidenceScore: FALLBACK_CONFIDENCE,
      category: 'other',
      urgency: 'low',
      reasoningSummary: (output.trim() || 'Sentiment analysis unavailable.').slice(
        0,
        MAX_REASONING_LENGTH,
      ),
      keySignals: [],
    };
  }

  private tryParseAsJson(output: string): SentimentAnalysisResult | null {
    const jsonCandidates = [output, this.extractCodeBlockJson(output)].filter(
      (value): value is string => Boolean(value && value.trim()),
    );

    for (const candidate of jsonCandidates) {
      try {
        const parsed = JSON.parse(candidate);
        const validated = responseSchema.parse(parsed);
        const label = (validated.label ?? validated.sentiment ?? FALLBACK_LABEL) as
          | 'positive'
          | 'neutral'
          | 'negative'
          | 'mixed';
        const confidence = normalizeConfidence(validated.confidence ?? validated.confidenceScore);
        const score = normalizeScore(label, validated.score, confidence);

        return {
          label,
          sentiment: label,
          score,
          confidence,
          confidenceScore: confidence,
          category: validated.category,
          urgency: validated.urgency,
          reasoningSummary: validated.reasoningSummary.trim().slice(0, MAX_REASONING_LENGTH),
          keySignals: this.normalizeSignals(validated.keySignals),
        };
      } catch {
        continue;
      }
    }

    return null;
  }

  private extractCodeBlockJson(text: string): string | null {
    const fencedMatch = text.match(/```json\s*([\s\S]*?)\s*```/i);
    if (fencedMatch?.[1]) {
      return fencedMatch[1].trim();
    }

    const braceStart = text.indexOf('{');
    const braceEnd = text.lastIndexOf('}');

    if (braceStart >= 0 && braceEnd > braceStart) {
      return text.slice(braceStart, braceEnd + 1).trim();
    }

    return null;
  }

  private normalizeSignals(signals: string[]): string[] {
    return Array.from(
      new Set(
        signals
          .map((signal) => signal.trim())
          .filter((signal) => signal.length > 0)
          .slice(0, MAX_KEY_SIGNALS),
      ),
    );
  }

  protected override buildCacheKey(input: AgentInput<SentimentAnalysisPayload>): string | null {
    const text = input.payload?.text?.trim();
    if (!text) {
      return null;
    }

    return JSON.stringify({
      userId: input.context?.userId ?? null,
      feedbackId: input.payload.feedbackId,
      text,
      feedbackType: input.payload.feedbackType,
    });
  }
}
