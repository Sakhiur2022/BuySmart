import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SellerFeedbackHighlightIdentity } from '@/components/seller/seller-feedback-highlight-identity';
import type { FeedbackInsightsResponse } from '@/lib/types/insights.types';

const SENTIMENT_META = {
  positive: {
    label: 'Positive',
    chip: 'border-emerald-200 bg-emerald-100 text-emerald-700',
    dot: 'bg-emerald-500',
  },
  neutral: {
    label: 'Neutral',
    chip: 'border-slate-200 bg-slate-100 text-slate-700',
    dot: 'bg-slate-500',
  },
  negative: {
    label: 'Negative',
    chip: 'border-rose-200 bg-rose-100 text-rose-700',
    dot: 'bg-rose-500',
  },
  mixed: {
    label: 'Mixed',
    chip: 'border-amber-200 bg-amber-100 text-amber-700',
    dot: 'bg-amber-500',
  },
};

type SellerInsightsWidgetProps = {
  feedbackInsights: FeedbackInsightsResponse | null;
  feedbackInsightsError: string | null;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatPercentage(value: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
  }).format(value);
}

function formatConfidence(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(value);
}

function resolveScoreLabel(score: number) {
  if (score >= 0.2) {
    return { label: 'Positive', className: 'text-emerald-600' };
  }

  if (score <= -0.2) {
    return { label: 'Negative', className: 'text-rose-600' };
  }

  return { label: 'Neutral', className: 'text-slate-600' };
}

export function SellerInsightsWidget({
  feedbackInsights,
  feedbackInsightsError,
}: SellerInsightsWidgetProps) {
  const scoreLabel = feedbackInsights
    ? resolveScoreLabel(feedbackInsights.averageSentimentScore)
    : null;

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <Card>
        <CardHeader className="border-b">
          <div className="space-y-1">
            <CardTitle>Sentiment Summary</CardTitle>
            <CardDescription>Last 30 days of feedback sentiment.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {feedbackInsightsError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {feedbackInsightsError}
            </div>
          ) : feedbackInsights ? (
            <Tabs defaultValue="overall" className="space-y-4">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="overall">Overall</TabsTrigger>
                <TabsTrigger value="products">Per product</TabsTrigger>
              </TabsList>
              <TabsContent value="overall" className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border bg-muted/20 px-4 py-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Feedback Volume
                    </p>
                    <p className="mt-2 text-2xl font-semibold">
                      {formatNumber(feedbackInsights.totalFeedbackCount)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Classified:{' '}
                      {formatNumber(feedbackInsights.sentimentBreakdown.totalClassified)}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 px-4 py-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Avg Sentiment Score
                    </p>
                    <div className="mt-2 flex items-baseline gap-3">
                      <p className="text-2xl font-semibold">
                        {feedbackInsights.averageSentimentScore.toFixed(2)}
                      </p>
                      {scoreLabel ? (
                        <span className={`text-xs font-semibold ${scoreLabel.className}`}>
                          {scoreLabel.label}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Scale -1 to 1</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {(['positive', 'neutral', 'negative', 'mixed'] as const).map((sentiment) => {
                    const metric = feedbackInsights.sentimentBreakdown[sentiment];
                    const meta = SENTIMENT_META[sentiment];
                    const percentage = Math.min(100, Math.max(0, metric.percentage));

                    return (
                      <div key={sentiment} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                            <span className="font-medium text-foreground">{meta.label}</span>
                          </div>
                          <span className="text-muted-foreground">
                            {formatNumber(metric.count)} ({formatPercentage(percentage)}%)
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted">
                          <div
                            className={`h-2 rounded-full ${meta.dot}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>
              <TabsContent value="products" className="space-y-4">
                {feedbackInsights.perProductSummaries.length === 0 ? (
                  <div className="rounded-xl border border-dashed bg-muted/30 px-6 py-10 text-center text-sm text-muted-foreground">
                    No product feedback yet. Per-product breakdown will appear here.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <th className="px-3 py-2">Product</th>
                          <th className="px-3 py-2">Positive</th>
                          <th className="px-3 py-2">Neutral</th>
                          <th className="px-3 py-2">Negative</th>
                          <th className="px-3 py-2">Mixed</th>
                          <th className="px-3 py-2">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {feedbackInsights.perProductSummaries.map((summary) => (
                          <tr key={summary.productId} className="border-b last:border-b-0">
                            <td className="px-3 py-3 font-medium text-foreground">
                              {summary.productName}
                            </td>
                            <td className="px-3 py-3 text-muted-foreground">
                              {formatNumber(summary.sentimentBreakdown.positive.count)} (
                              {formatPercentage(summary.sentimentBreakdown.positive.percentage)}%)
                            </td>
                            <td className="px-3 py-3 text-muted-foreground">
                              {formatNumber(summary.sentimentBreakdown.neutral.count)} (
                              {formatPercentage(summary.sentimentBreakdown.neutral.percentage)}%)
                            </td>
                            <td className="px-3 py-3 text-muted-foreground">
                              {formatNumber(summary.sentimentBreakdown.negative.count)} (
                              {formatPercentage(summary.sentimentBreakdown.negative.percentage)}%)
                            </td>
                            <td className="px-3 py-3 text-muted-foreground">
                              {formatNumber(summary.sentimentBreakdown.mixed.count)} (
                              {formatPercentage(summary.sentimentBreakdown.mixed.percentage)}%)
                            </td>
                            <td className="px-3 py-3 text-foreground">
                              {formatNumber(summary.totalClassified)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            <div className="rounded-xl border border-dashed bg-muted/30 px-6 py-10 text-center text-sm text-muted-foreground">
              No feedback insights yet. Check back once customers leave reviews.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <div className="space-y-1">
            <CardTitle>Top Feedback</CardTitle>
            <CardDescription>Highlights with strongest sentiment signals.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {feedbackInsights ? (
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">Positive</p>
                  <Badge className={SENTIMENT_META.positive.chip}>Top signals</Badge>
                </div>
                {feedbackInsights.highlights.positive.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No positive highlights yet.</p>
                ) : (
                  <div className="space-y-3">
                    {feedbackInsights.highlights.positive.map((highlight) => (
                      <div key={highlight.feedbackId} className="rounded-lg border px-4 py-3">
                        <SellerFeedbackHighlightIdentity highlight={highlight} />
                        <p className="mt-2 text-sm text-foreground line-clamp-3">
                          {highlight.snippet}
                        </p>
                        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                          <span>{new Date(highlight.createdAt).toLocaleDateString('en-US')}</span>
                          <span>Confidence {formatConfidence(highlight.confidenceScore)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">Negative</p>
                  <Badge className={SENTIMENT_META.negative.chip}>Needs attention</Badge>
                </div>
                {feedbackInsights.highlights.negative.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No negative highlights yet.</p>
                ) : (
                  <div className="space-y-3">
                    {feedbackInsights.highlights.negative.map((highlight) => (
                      <div key={highlight.feedbackId} className="rounded-lg border px-4 py-3">
                        <SellerFeedbackHighlightIdentity highlight={highlight} />
                        <p className="mt-2 text-sm text-foreground line-clamp-3">
                          {highlight.snippet}
                        </p>
                        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                          <span>{new Date(highlight.createdAt).toLocaleDateString('en-US')}</span>
                          <span>Confidence {formatConfidence(highlight.confidenceScore)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed bg-muted/30 px-6 py-10 text-center text-sm text-muted-foreground">
              Top feedback will appear once sentiment analysis completes.
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
