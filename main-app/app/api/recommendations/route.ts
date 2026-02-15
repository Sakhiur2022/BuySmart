import { NextResponse } from "next/server";
import { z } from "zod";

import { RecommendationAgent } from "@/lib/agents/recommendation/recommendation-agent";
import { createClient } from "@/lib/supabase/server";

const candidateSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  category: z.string().min(1).max(120).optional(),
  brand: z.string().min(1).max(120).optional(),
  price: z.number().nonnegative().optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
});

const constraintsSchema = z
  .object({
    budgetMin: z.number().nonnegative().optional(),
    budgetMax: z.number().nonnegative().optional(),
    categories: z.array(z.string().min(1).max(120)).max(20).optional(),
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
      message: "budgetMin must be less than or equal to budgetMax",
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
    return NextResponse.json(
      { error: "Invalid JSON payload." },
      { status: 400 },
    );
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed.",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  const agent = new RecommendationAgent();
  const result = await agent.run({
    task: "recommendation",
    payload: parsed.data,
    context: data.user ? { userId: data.user.id } : undefined,
  });

  const maxResults = parsed.data.constraints?.maxResults;
  const trimmedResult = maxResults
    ? {
        ...result.result,
        recommendations: result.result.recommendations.slice(0, maxResults),
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
