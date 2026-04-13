import { z } from 'zod';

import { BaseAgent } from '@/lib/agents/base-agent';
import { AGENT_PROMPTS } from '@/lib/agents/prompts';
import type { AgentInput } from '@/lib/agents/types';
import type {
  SentimentAnalysisPayload,
  SentimentAnalysisResult,
} from '@/lib/agents/sentiment/types';

const responseSchema = z.object({
  sentiment: z.enum(['positive', 'neutral', 'negative', 'mixed']),
  confidenceScore: z.number().min(0).max(1),
  category: z.enum([
    'product_quality',
    'delivery',
    'customer_service',
    'pricing',
    'user_experience',
    'other',
  ]),
  urgency: z.enum(['low', 'medium', 'high', 'critical']),
  reasoningSummary: z.string().min(1).max(300),
  keySignals: z.array(z.string().min(1).max(80)).max(8),
});

export class SentimentAgent extends BaseAgent<SentimentAnalysisPayload, SentimentAnalysisResult> {
  readonly name = 'sentiment';
  readonly version = '1.0.0';
  protected cacheTtlMs = 10 * 60 * 1000;

  protected readonly systemPrompt = `${AGENT_PROMPTS.sentiment}

Return JSON only with this exact structure:
{
  "sentiment": "positive | neutral | negative | mixed",
  "confidenceScore": 0.0,
  "category": "product_quality | delivery | customer_service | pricing | user_experience | other",
  "urgency": "low | medium | high | critical",
  "reasoningSummary": "brief explanation under 300 chars",
  "keySignals": ["signal 1", "signal 2"]
}

Rules:
- Base sentiment strictly on provided feedback text.
- confidenceScore must be between 0 and 1.
- reasoningSummary must be concise, factual, and non-sensitive.
- keySignals should be short phrases and include only strongest cues.`;

  protected parseOutput(output: string): SentimentAnalysisResult {
    const parsedFromJson = this.tryParseAsJson(output);
    if (parsedFromJson) {
      return parsedFromJson;
    }

    return {
      sentiment: 'neutral',
      confidenceScore: 0,
      category: 'other',
      urgency: 'low',
      reasoningSummary: (output.trim() || 'Sentiment analysis unavailable.').slice(0, 300),
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

        return {
          sentiment: validated.sentiment,
          confidenceScore: Math.max(0, Math.min(1, Number(validated.confidenceScore))),
          category: validated.category,
          urgency: validated.urgency,
          reasoningSummary: validated.reasoningSummary.trim().slice(0, 300),
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
          .slice(0, 8),
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
