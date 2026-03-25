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
import { cn } from '@/lib/utils';
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

interface RecommendationBroadcastItem {
  productId: string;
  title: string;
  reason: string;
  score: number;
  price?: number;
}

interface RecommendationPanelProps {
  isAuthenticated: boolean;
  userEmail?: string | null;
  userDisplayName?: string;
  candidates?: ProductCandidate[];
  compact?: boolean;
}

const MAX_RESULTS_OPTIONS = ['2', '3', '4', '5', '6'];

const MAX_RESULTS_BY_MODE = {
  guest: 3,
  member: 6,
} as const;

const toNumber = (value: string): number | undefined => {
  if (!value.trim()) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export function RecommendationPanel({
  isAuthenticated,
  userEmail,
  userDisplayName,
  candidates = [],
  compact = false,
}: RecommendationPanelProps) {
  const [userIntent, setUserIntent] = useState('I need gear for remote work and travel under $200');
  const [contextSummary, setContextSummary] = useState(
    'Prioritize lightweight products and practical daily use.',
  );
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('200');
  const [maxResults, setMaxResults] = useState(isAuthenticated ? '4' : '3');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);

  const candidateLookup = useMemo(
    () =>
      new Map<string, ProductCandidate>(candidates.map((candidate) => [candidate.id, candidate])),
    [candidates],
  );

  const maxAllowedResults = isAuthenticated
    ? MAX_RESULTS_BY_MODE.member
    : MAX_RESULTS_BY_MODE.guest;
  const hasCandidates = candidates.length > 0;

  const generateRecommendations = async () => {
    if (!hasCandidates) {
      setErrorMessage('No catalog products are available yet. Add active products first.');
      return;
    }

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

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('buysmart:recommendations:loading'));
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
        setHasGenerated(false);
        setErrorMessage(data.errorMessage ?? data.error ?? fallbackError);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('buysmart:recommendations:error'));
        }
        return;
      }

      setHasGenerated(true);

      if (typeof window !== 'undefined') {
        const recommendedItems: RecommendationBroadcastItem[] = data.result.recommendations
          .filter((recommendation) => Boolean(recommendation.productId?.trim()))
          .map((recommendation) => ({
            productId: recommendation.productId!.trim(),
            title: recommendation.title,
            reason: recommendation.reason,
            score: recommendation.score,
            price: recommendation.price,
          }));

        window.dispatchEvent(
          new CustomEvent('buysmart:recommendations', {
            detail: {
              summary: data.result.summary,
              items: recommendedItems,
            },
          }),
        );
      }
    } catch {
      setHasGenerated(false);
      setErrorMessage('Unable to connect to recommendation service right now.');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('buysmart:recommendations:error'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className={cn('border-primary/20', compact && 'gap-4')}>
      <CardHeader className={cn('space-y-3', compact && 'px-4 pb-0')}>
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

      <CardContent className={cn('space-y-6', compact && 'space-y-4 px-4 pb-4')}>
        <div className={cn('grid grid-cols-1 gap-4', compact && 'gap-3')}>
          <div className="space-y-2">
            <Label htmlFor="intent">What are you looking for?</Label>
            <Textarea
              id="intent"
              value={userIntent}
              onChange={(event) => setUserIntent(event.target.value)}
              placeholder="Example: I need affordable wireless gear for travel and calls."
              className={cn(compact && 'min-h-24 text-sm')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="context">Extra context (optional)</Label>
            <Textarea
              id="context"
              value={contextSummary}
              onChange={(event) => setContextSummary(event.target.value)}
              placeholder="Example: I prefer lightweight products from trusted brands."
              className={cn(compact && 'min-h-20 text-sm')}
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

          <div className={cn('space-y-2 md:max-w-52', compact && 'md:max-w-none')}>
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
          <Button
            type="button"
            onClick={generateRecommendations}
            disabled={isLoading || !hasCandidates}
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <WandSparkles className="size-4" />
                {hasCandidates
                  ? isAuthenticated
                    ? 'Generate Recommendations'
                    : 'Generate Guest Recommendations'
                  : 'No Products Available'}
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

        {!hasCandidates ? (
          <div className="rounded-lg border border-amber-300/70 bg-amber-100/60 px-3 py-2 text-sm text-amber-900 dark:border-amber-600/70 dark:bg-amber-950/40 dark:text-amber-200">
            No active products were loaded from the catalog. Add products in seller mode to enable
            recommendations.
          </div>
        ) : null}

        {!isLoading && !hasGenerated && !errorMessage ? (
          <div className="rounded-lg border border-border/70 bg-muted/25 p-4 text-sm text-muted-foreground">
            Enter your intent and constraints, then generate recommendations to see AI-ranked
            results.
          </div>
        ) : null}

        {hasGenerated && !errorMessage ? (
          <div className="rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm text-foreground">
            Recommendations were generated and applied to the product listing section.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
