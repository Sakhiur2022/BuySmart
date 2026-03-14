'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Loader2, Sparkles, WandSparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type {
  ProductCandidate,
  RecommendationPayload,
  RecommendationResult,
} from '@/lib/agents/recommendation/types';

interface RecommendationApiResponse {
  success: boolean;
  result: RecommendationResult;
  latencyMs?: number;
  errorMessage?: string;
}

interface RecommendationPanelProps {
  isAuthenticated: boolean;
  userEmail?: string | null;
  userDisplayName?: string;
  candidates?: ProductCandidate[];
}

const SAMPLE_CANDIDATES: ProductCandidate[] = [
  {
    id: 'p-101',
    title: 'Noise-Cancelling Headphones X9',
    category_id: 12,
    brand: 'SonicPeak',
    price: 149.99,
    tags: ['audio', 'wireless', 'travel'],
  },
  {
    id: 'p-102',
    title: 'Smartwatch Pulse 4',
    category_id: 7,
    brand: 'NovaWear',
    price: 199,
    tags: ['fitness', 'wearable', 'health'],
  },
  {
    id: 'p-103',
    title: 'USB-C Fast Charger 65W',
    category_id: 18,
    brand: 'VoltCore',
    price: 39.5,
    tags: ['charger', 'accessory', 'portable'],
  },
  {
    id: 'p-104',
    title: 'Mechanical Keyboard K80',
    category_id: 4,
    brand: 'TypeForge',
    price: 89,
    tags: ['keyboard', 'gaming', 'office'],
  },
  {
    id: 'p-105',
    title: '4K Webcam Studio Lite',
    category_id: 9,
    brand: 'FrameFocus',
    price: 119,
    tags: ['camera', 'streaming', 'remote-work'],
  },
];

const MAX_RESULTS_OPTIONS = ['2', '3', '4', '5', '6'];

const MAX_RESULTS_BY_MODE = {
  guest: 3,
  member: 6,
} as const;

const getScoreBarClassName = (score: number) => {
  const percentage = Math.round(Math.max(0, Math.min(1, score)) * 100);

  if (percentage >= 90) return 'w-full';
  if (percentage >= 80) return 'w-10/12';
  if (percentage >= 70) return 'w-9/12';
  if (percentage >= 60) return 'w-8/12';
  if (percentage >= 50) return 'w-7/12';
  if (percentage >= 40) return 'w-6/12';
  if (percentage >= 30) return 'w-5/12';
  if (percentage >= 20) return 'w-4/12';
  if (percentage >= 10) return 'w-3/12';
  return 'w-2/12';
};

const toNumber = (value: string): number | undefined => {
  if (!value.trim()) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

export function RecommendationPanel({
  isAuthenticated,
  userEmail,
  userDisplayName,
  candidates = SAMPLE_CANDIDATES,
}: RecommendationPanelProps) {
  const [userIntent, setUserIntent] = useState('I need gear for remote work and travel under $200');
  const [contextSummary, setContextSummary] = useState(
    'Prioritize lightweight products and practical daily use.',
  );
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('200');
  const [maxResults, setMaxResults] = useState(isAuthenticated ? '4' : '3');

  const [isLoading, setIsLoading] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<RecommendationResult | null>(null);

  const candidateLookup = useMemo(
    () =>
      new Map<string, ProductCandidate>(candidates.map((candidate) => [candidate.id, candidate])),
    [candidates],
  );

  const maxAllowedResults = isAuthenticated
    ? MAX_RESULTS_BY_MODE.member
    : MAX_RESULTS_BY_MODE.guest;

  const generateRecommendations = async () => {
    const trimmedIntent = userIntent.trim();
    if (trimmedIntent.length < 3) {
      setErrorMessage('Please provide a clearer intent (at least 3 characters).');
      return;
    }

    const parsedBudgetMin = toNumber(budgetMin);
    const parsedBudgetMax = toNumber(budgetMax);
    const parsedMaxResults = toNumber(maxResults);
    const cappedMaxResults = Math.min(parsedMaxResults ?? maxAllowedResults, maxAllowedResults);

    const constraints: RecommendationPayload['constraints'] = {
      budgetMin: parsedBudgetMin,
      budgetMax: parsedBudgetMax,
      maxResults: cappedMaxResults,
    };

    if (
      constraints.budgetMin !== undefined &&
      constraints.budgetMax !== undefined &&
      constraints.budgetMin > constraints.budgetMax
    ) {
      setErrorMessage('Minimum budget cannot be greater than maximum budget.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const payload: RecommendationPayload = {
      userIntent: trimmedIntent,
      contextSummary: contextSummary.trim() || undefined,
      candidates,
      constraints,
    };

    try {
      const response = await fetch('/api/recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as RecommendationApiResponse & {
        error?: string;
      };

      if (!response.ok || !data.success) {
        const fallbackError = 'Recommendation request failed. Please try again.';
        setResult(null);
        setLatencyMs(null);
        setErrorMessage(data.errorMessage ?? data.error ?? fallbackError);
        return;
      }

      setResult(data.result);
      setLatencyMs(data.latencyMs ?? null);
    } catch {
      setResult(null);
      setLatencyMs(null);
      setErrorMessage('Unable to connect to recommendation service right now.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-lg bg-primary/15 p-2 text-primary">
            <Sparkles className="size-4" />
          </div>
          <CardTitle className="text-xl">AI Recommendations</CardTitle>
          <Badge variant={isAuthenticated ? 'default' : 'secondary'}>
            {isAuthenticated ? 'Member Mode' : 'Guest Mode'}
          </Badge>
        </div>
        <CardDescription>
          {isAuthenticated
            ? 'Describe what you need, then let the recommendation agent rank matching products.'
            : 'Try the recommendation engine as a guest. You can sign in later for richer personalization.'}
        </CardDescription>
        {isAuthenticated && userEmail ? (
          <p className="text-xs text-muted-foreground">
            Personalizing for {userDisplayName ?? userEmail}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Guest sessions are not persisted.{' '}
            <Link href="/auth/sign-up" className="text-primary hover:underline">
              Create an account
            </Link>{' '}
            to save your buyer profile.
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="intent">What are you looking for?</Label>
            <Textarea
              id="intent"
              value={userIntent}
              onChange={(event) => setUserIntent(event.target.value)}
              placeholder="Example: I need affordable wireless gear for travel and calls."
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="context">Extra context (optional)</Label>
            <Textarea
              id="context"
              value={contextSummary}
              onChange={(event) => setContextSummary(event.target.value)}
              placeholder="Example: I prefer lightweight products from trusted brands."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="budget-min">Min budget (USD)</Label>
            <Input
              id="budget-min"
              inputMode="decimal"
              value={budgetMin}
              onChange={(event) => setBudgetMin(event.target.value)}
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="budget-max">Max budget (USD)</Label>
            <Input
              id="budget-max"
              inputMode="decimal"
              value={budgetMax}
              onChange={(event) => setBudgetMax(event.target.value)}
              placeholder="200"
            />
          </div>

          <div className="space-y-2 md:max-w-52">
            <Label htmlFor="max-results">Max results</Label>
            <Select value={maxResults} onValueChange={setMaxResults}>
              <SelectTrigger id="max-results" className="w-full">
                <SelectValue placeholder="Select max results" />
              </SelectTrigger>
              <SelectContent>
                {MAX_RESULTS_OPTIONS.map((value) => {
                  const isOverGuestLimit =
                    !isAuthenticated && Number(value) > MAX_RESULTS_BY_MODE.guest;

                  return (
                    <SelectItem
                      key={value}
                      value={value}
                      disabled={isOverGuestLimit}
                      className={isOverGuestLimit ? 'opacity-50' : undefined}
                    >
                      {value}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {!isAuthenticated ? (
              <p className="text-xs text-muted-foreground">Guests can request up to 3 results.</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={generateRecommendations} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <WandSparkles className="size-4" />
                {isAuthenticated ? 'Generate Recommendations' : 'Generate Guest Recommendations'}
              </>
            )}
          </Button>

          <span className="text-xs text-muted-foreground">
            Candidates available: {candidates.length}
          </span>
        </div>

        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={`skeleton-${index}`}
                className="space-y-3 rounded-lg border bg-card p-4 shadow-sm"
              >
                <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                <div className="h-3 w-full animate-pulse rounded bg-muted" />
                <div className="h-3 w-10/12 animate-pulse rounded bg-muted" />
                <div className="h-2 w-full animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : null}

        {!isLoading && !result && !errorMessage ? (
          <div className="rounded-lg border border-border/70 bg-muted/25 p-4 text-sm text-muted-foreground">
            Enter your intent and constraints, then generate recommendations to see AI-ranked
            results.
          </div>
        ) : null}

        {result ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-border/70 bg-muted/25 p-4">
              <p className="text-sm leading-6">{result.summary}</p>
              {latencyMs !== null ? (
                <p className="mt-2 text-xs text-muted-foreground">Latency: {latencyMs}ms</p>
              ) : null}
            </div>

            {result.recommendations.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {result.recommendations.map((recommendation, index) => {
                  const normalizedScore = Math.max(0, Math.min(1, recommendation.score));
                  const productId = recommendation.productId?.trim();
                  const match: ProductCandidate | undefined = productId
                    ? candidateLookup.get(productId)
                    : undefined;

                  return (
                    <div
                      key={`${recommendation.title}-${index}`}
                      className="rounded-lg border bg-card p-4 shadow-sm"
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <h3 className="text-sm font-semibold leading-5">{recommendation.title}</h3>
                        <Badge variant="secondary">{Math.round(normalizedScore * 100)}%</Badge>
                      </div>

                      <p className="text-sm text-muted-foreground">{recommendation.reason}</p>

                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full bg-primary ${getScoreBarClassName(normalizedScore)}`}
                        />
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {recommendation.price !== undefined ? (
                          <span>{priceFormatter.format(recommendation.price)}</span>
                        ) : null}
                        {productId ? <span>ID: {productId}</span> : null}
                        {match?.brand ? <span>Brand: {match.brand}</span> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-border/70 bg-muted/25 p-4">
                <p className="text-sm text-muted-foreground">
                  No recommendations were returned. Try broadening your intent or constraints.
                </p>
              </div>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
