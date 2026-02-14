import { z } from "zod";

import { BaseAgent } from "@/lib/agents/base-agent";
import { AGENT_PROMPTS } from "@/lib/agents/prompts";
import type {
  ProductRecommendation,
  RecommendationPayload,
  RecommendationResult,
} from "@/lib/agents/recommendation/types";

const responseSchema = z.object({
  summary: z.string().min(1).max(500),
  recommendations: z
    .array(
      z.object({
        productId: z.string().optional(),
        title: z.string().min(1).max(200),
        reason: z.string().min(1).max(400),
        score: z.number().min(0).max(1),
        category: z.string().optional(),
        price: z.number().nonnegative().optional(),
      }),
    )
    .min(1)
    .max(10),
});

export class RecommendationAgent extends BaseAgent<
  RecommendationPayload,
  RecommendationResult
> {
  readonly name = "recommendation";

  protected readonly systemPrompt = `${AGENT_PROMPTS.recommendation}

Return JSON only with this structure:
{
  "summary": "string",
  "recommendations": [
    {
      "productId": "string (optional)",
      "title": "string",
      "reason": "string",
      "score": 0.0,
      "category": "string (optional)",
      "price": 0
    }
  ]
}

Rules:
- Recommend only from provided candidates.
- Respect budget/category/brand/tag constraints if provided.
- Keep reason concise and concrete.
- Sort by highest score first.
- Score must be between 0 and 1.`;

  protected parseOutput(output: string): RecommendationResult {
    const parsedFromJson = this.tryParseAsJson(output);

    if (parsedFromJson) {
      return parsedFromJson;
    }

    const fallbackSummary = output.trim() || "No recommendation response received.";

    return {
      summary: fallbackSummary.slice(0, 500),
      recommendations: [],
    };
  }

  private tryParseAsJson(output: string): RecommendationResult | null {
    const jsonCandidates = [output, this.extractCodeBlockJson(output)].filter(
      (value): value is string => Boolean(value && value.trim()),
    );

    for (const candidate of jsonCandidates) {
      try {
        const parsed = JSON.parse(candidate);
        const validated = responseSchema.parse(parsed);

        return {
          summary: validated.summary,
          recommendations: this.normalizeRecommendations(validated.recommendations),
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

    const braceStart = text.indexOf("{");
    const braceEnd = text.lastIndexOf("}");

    if (braceStart >= 0 && braceEnd > braceStart) {
      return text.slice(braceStart, braceEnd + 1).trim();
    }

    return null;
  }

  private normalizeRecommendations(
    recommendations: ProductRecommendation[],
  ): ProductRecommendation[] {
    return recommendations
      .map((item) => ({
        ...item,
        score: Math.max(0, Math.min(1, Number(item.score))),
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, 10);
  }
}
