import { BaseAgent } from '@/lib/agents/base-agent';
import type { AgentInput } from '@/lib/agents/types';

import {
  REFUND_DECISION_SCHEMA_VERSION,
  refundDecisionInputSchema,
  refundDecisionModelPayloadSchema,
  refundDecisionOutputSchema,
  type RefundDecisionInput,
  type RefundDecisionOutput,
} from '@/lib/agents/refund/types';
import { REFUND_DECISION_SYSTEM_PROMPT } from '@/lib/agents/refund/refund-decision-prompt';

export class RefundDecisionAgent extends BaseAgent<RefundDecisionInput, RefundDecisionOutput> {
  public readonly name = 'refund-decision';
  public readonly version = '1.0.0';
  protected cacheTtlMs = 2 * 60 * 1000;
  protected readonly systemPrompt = REFUND_DECISION_SYSTEM_PROMPT;

  protected parseOutput(output: string): RefundDecisionOutput {
    const parsed = this.tryParseAsJson(output);

    if (parsed) {
      return parsed;
    }

    return {
      schemaVersion: REFUND_DECISION_SCHEMA_VERSION,
      recommendation: 'manual_review',
      riskScore: 0.5,
      confidenceScore: 0.2,
      reasoning: (
        output.trim() || 'AI response was not parseable; manual review recommended.'
      ).slice(0, 600),
      signals: [],
      modelMetadata: {
        provider: 'groq',
        model: 'unknown',
        fallbackUsed: true,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  private tryParseAsJson(output: string): RefundDecisionOutput | null {
    const candidates = [output, this.extractCodeBlockJson(output)].filter(
      (value): value is string => Boolean(value && value.trim()),
    );

    for (const candidate of candidates) {
      try {
        const inputParsed = refundDecisionInputSchema.safeParse(JSON.parse(candidate));
        if (inputParsed.success) {
          continue;
        }

        const payload = refundDecisionModelPayloadSchema.parse(JSON.parse(candidate));
        return refundDecisionOutputSchema.parse({
          schemaVersion: REFUND_DECISION_SCHEMA_VERSION,
          recommendation: payload.recommendation,
          riskScore: payload.riskScore,
          confidenceScore: payload.confidenceScore,
          reasoning: payload.reasoning,
          signals: payload.signals,
          modelMetadata: {
            provider: 'groq',
            model: 'unknown',
            fallbackUsed: false,
            generatedAt: new Date().toISOString(),
          },
        });
      } catch {
        continue;
      }
    }

    return null;
  }

  private extractCodeBlockJson(text: string): string | null {
    const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i);
    if (fenced?.[1]) {
      return fenced[1].trim();
    }

    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');

    if (start >= 0 && end > start) {
      return text.slice(start, end + 1).trim();
    }

    return null;
  }

  protected override buildCacheKey(input: AgentInput<RefundDecisionInput>): string | null {
    const parsed = refundDecisionInputSchema.safeParse(input.payload);

    if (!parsed.success) {
      return null;
    }

    return JSON.stringify({
      refundId: parsed.data.refund.refundId,
      userId: input.context?.userId ?? null,
      payload: parsed.data,
    });
  }
}
