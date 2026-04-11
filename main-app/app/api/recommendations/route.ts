import { NextResponse } from 'next/server';
import { z } from 'zod';

import { AgentOrchestrator } from '@/lib/agents/orchestrator';
import { RecommendationAgent } from '@/lib/agents/recommendation/recommendation-agent';
import type {
  RecommendationPayload,
  RecommendationResult,
} from '@/lib/agents/recommendation/types';
import { createClient } from '@/lib/supabase/server';

const orchestrator = new AgentOrchestrator();
orchestrator.register(new RecommendationAgent());

const candidateSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  category_id: z.number().int().nonnegative().optional(),
  brand: z.string().min(1).max(120).optional(),
  price: z.number().nonnegative().optional(),
  image: z.string().max(2048).optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
});

const constraintsSchema = z
  .object({
    budgetMin: z.number().nonnegative().optional(),
    budgetMax: z.number().nonnegative().optional(),
    category_ids: z.array(z.number().int().nonnegative()).max(20).optional(),
    brands: z.array(z.string().min(1).max(120)).max(20).optional(),
    mustHaveTags: z.array(z.string().min(1).max(50)).max(20).optional(),
    excludeProductIds: z.array(z.string().min(1).max(100)).max(50).optional(),
    maxResults: z.number().int().min(1).max(10).optional(),
  })
  .refine(
    (value) =>
      value.budgetMin === undefined ||
      value.budgetMax === undefined ||
      value.budgetMin <= value.budgetMax,
    {
      message: 'budgetMin must be less than or equal to budgetMax',
    },
  );

const requestSchema = z.object({
  userIntent: z.string().min(3).max(500),
  contextSummary: z.string().max(500).optional(),
  candidates: z.array(candidateSchema).min(1).max(100),
  constraints: constraintsSchema.optional(),
});

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Validation failed.',
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  const result = await orchestrator.dispatch<RecommendationPayload, RecommendationResult>(
    'recommendation',
    parsed.data, // This matches RecommendationPayload structurally due to zod validation
    data.user ? { userId: data.user.id } : undefined,
  );

  const maxResults = parsed.data.constraints?.maxResults;
  const candidateIds = new Set(parsed.data.candidates.map((candidate) => candidate.id));
  const filteredRecommendations = result.result.recommendations.filter((item) =>
    item.productId ? candidateIds.has(item.productId) : false,
  );
  const limitedRecommendations = maxResults
    ? filteredRecommendations.slice(0, maxResults)
    : filteredRecommendations;
  const trimmedResult = result.success
    ? {
        ...result.result,
        summary:
          limitedRecommendations.length > 0
            ? result.result.summary
            : 'No matching products found for that request.',
        recommendations: limitedRecommendations,
      }
    : result.result;

  return NextResponse.json(
    {
      ...result,
      result: trimmedResult,
    },
    { status: result.success ? 200 : 502 },
  );
}
