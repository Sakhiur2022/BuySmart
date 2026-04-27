import type { UserRole } from '@/lib/models/feedback.model';
import {
  countPublishedFeedbackForInsights,
  fetchProcessedFeedbackForInsights,
  fetchUserRole,
  type FeedbackInsightsRecord,
} from '@/lib/repositories/feedback.repository';
import type {
  FeedbackHighlight,
  FeedbackInsightsResponse,
  FeedbackTrendPoint,
  FeedbackAISentiment,
  InsightsQueryInput,
  InsightsTimeframe,
  SentimentMetric,
} from '@/lib/types/insights.types';

const DAYS_IN_WEEK = 7;
const DAYS_IN_MONTH = 30;
const MAX_HIGHLIGHTS = 3;
const HIGHLIGHT_SNIPPET_LENGTH = 220;
const PERCENTAGE_PRECISION = 100;
const SCORE_PRECISION = 1000;

interface ScopeResolution {
  role: UserRole;
  sellerId?: string;
}

interface SentimentCounters {
  positive: number;
  neutral: number;
  negative: number;
  mixed: number;
}

interface ProductSummaryAccumulator {
  productId: string;
  productName: string;
  counters: SentimentCounters;
  totalClassified: number;
  scoreTotal: number;
}

function roundTo(value: number, precision: number): number {
  return Math.round(value * precision) / precision;
}

function clampConfidence(value: number | null): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, Number(value)));
}

function deriveSentimentScore(sentiment: FeedbackAISentiment, confidence: number): number {
  switch (sentiment) {
    case 'positive':
      return confidence;
    case 'negative':
      return -confidence;
    case 'neutral':
    case 'mixed':
      return 0;
    default:
      return 0;
  }
}

function resolveTimeframeStart(timeframe: InsightsTimeframe, now: Date): string | undefined {
  if (timeframe === 'all') {
    return undefined;
  }

  const daysToSubtract = timeframe === '7d' ? DAYS_IN_WEEK - 1 : DAYS_IN_MONTH - 1;
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - daysToSubtract);
  start.setUTCHours(0, 0, 0, 0);
  return start.toISOString();
}

async function resolveScope(userId: string, sellerId?: string): Promise<ScopeResolution> {
  const role = await fetchUserRole(userId);

  if (!role) {
    throw new Error('UNAUTHENTICATED');
  }

  if (role === 'buyer') {
    throw new Error('FORBIDDEN');
  }

  if (role === 'seller') {
    if (sellerId && sellerId !== userId) {
      throw new Error('FORBIDDEN');
    }

    return {
      role,
      sellerId: userId,
    };
  }

  return {
    role,
    sellerId,
  };
}

function toSnippet(record: FeedbackInsightsRecord): string {
  const title = (record.title ?? '').trim();
  const comment = (record.comment ?? '').trim();

  const rawSnippet = title && comment ? `${title} - ${comment}` : title || comment;
  if (!rawSnippet) {
    return 'No feedback text available.';
  }

  return rawSnippet.replace(/\s+/g, ' ').slice(0, HIGHLIGHT_SNIPPET_LENGTH);
}

function toHighlight(record: FeedbackInsightsRecord): FeedbackHighlight {
  const buyerName = record.buyer_display_name ?? record.buyer_full_name;

  return {
    feedbackId: record.feedback_id,
    confidenceScore: clampConfidence(record.ai_confidence_score),
    snippet: toSnippet(record),
    createdAt: record.created_at,
    productName: record.product_name,
    buyerUserId: record.buyer_user_id,
    buyerName,
    buyerAvatarUrl: record.buyer_avatar_url,
  };
}

function calculateCounters(records: FeedbackInsightsRecord[]): SentimentCounters {
  return records.reduce<SentimentCounters>(
    (accumulator, record) => {
      switch (record.ai_sentiment) {
        case 'positive':
          accumulator.positive += 1;
          break;
        case 'neutral':
          accumulator.neutral += 1;
          break;
        case 'negative':
          accumulator.negative += 1;
          break;
        case 'mixed':
          accumulator.mixed += 1;
          break;
      }

      return accumulator;
    },
    {
      positive: 0,
      neutral: 0,
      negative: 0,
      mixed: 0,
    },
  );
}

function toSentimentMetric(count: number, denominator: number): SentimentMetric {
  if (denominator <= 0) {
    return { count, percentage: 0 };
  }

  return {
    count,
    percentage: roundTo((count / denominator) * PERCENTAGE_PRECISION, PERCENTAGE_PRECISION),
  };
}

function buildSentimentBreakdown(counters: SentimentCounters, totalClassified: number) {
  return {
    positive: toSentimentMetric(counters.positive, totalClassified),
    neutral: toSentimentMetric(counters.neutral, totalClassified),
    negative: toSentimentMetric(counters.negative, totalClassified),
    mixed: toSentimentMetric(counters.mixed, totalClassified),
  };
}

function formatDayBucket(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatMonthBucket(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function createTrendBuckets(
  timeframe: InsightsTimeframe,
  records: FeedbackInsightsRecord[],
  now: Date,
): Map<string, FeedbackTrendPoint> {
  const bucketMap = new Map<string, FeedbackTrendPoint>();

  if (timeframe === 'all') {
    const start = records.length > 0 ? new Date(records[0].created_at) : new Date(now);
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);

    const end = new Date(now);
    end.setUTCDate(1);
    end.setUTCHours(0, 0, 0, 0);

    const pointer = new Date(start);
    while (pointer <= end) {
      const bucketKey = formatMonthBucket(pointer);
      bucketMap.set(bucketKey, {
        periodStart: bucketKey,
        total: 0,
        positive: 0,
        neutral: 0,
        negative: 0,
        mixed: 0,
        averageSentimentScore: 0,
      });

      pointer.setUTCMonth(pointer.getUTCMonth() + 1);
    }

    return bucketMap;
  }

  const days = timeframe === '7d' ? DAYS_IN_WEEK : DAYS_IN_MONTH;
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  start.setUTCHours(0, 0, 0, 0);

  for (let index = 0; index < days; index += 1) {
    const bucketDate = new Date(start);
    bucketDate.setUTCDate(start.getUTCDate() + index);
    const bucketKey = formatDayBucket(bucketDate);

    bucketMap.set(bucketKey, {
      periodStart: bucketKey,
      total: 0,
      positive: 0,
      neutral: 0,
      negative: 0,
      mixed: 0,
      averageSentimentScore: 0,
    });
  }

  return bucketMap;
}

function buildTrend(
  timeframe: InsightsTimeframe,
  records: FeedbackInsightsRecord[],
  now: Date,
): FeedbackTrendPoint[] {
  const buckets = createTrendBuckets(timeframe, records, now);
  const scoreTotals = new Map<string, number>();

  records.forEach((record) => {
    const createdAt = new Date(record.created_at);
    const key = timeframe === 'all' ? formatMonthBucket(createdAt) : formatDayBucket(createdAt);
    const bucket = buckets.get(key);

    if (!bucket) {
      return;
    }

    const confidence = clampConfidence(record.ai_confidence_score);
    const score = deriveSentimentScore(record.ai_sentiment, confidence);

    bucket.total += 1;
    if (record.ai_sentiment === 'positive') {
      bucket.positive += 1;
    }
    if (record.ai_sentiment === 'neutral') {
      bucket.neutral += 1;
    }
    if (record.ai_sentiment === 'negative') {
      bucket.negative += 1;
    }
    if (record.ai_sentiment === 'mixed') {
      bucket.mixed += 1;
    }

    scoreTotals.set(key, (scoreTotals.get(key) ?? 0) + score);
  });

  return Array.from(buckets.values()).map((bucket) => {
    if (bucket.total > 0) {
      bucket.averageSentimentScore = roundTo(
        (scoreTotals.get(bucket.periodStart) ?? 0) / bucket.total,
        SCORE_PRECISION,
      );
    }

    return bucket;
  });
}

function calculateAverageSentimentScore(records: FeedbackInsightsRecord[]): number {
  if (records.length === 0) {
    return 0;
  }

  const totalScore = records.reduce((accumulator, record) => {
    const confidence = clampConfidence(record.ai_confidence_score);
    return accumulator + deriveSentimentScore(record.ai_sentiment, confidence);
  }, 0);

  return roundTo(totalScore / records.length, SCORE_PRECISION);
}

function buildPerProductSummaries(records: FeedbackInsightsRecord[]) {
  const summaryMap = new Map<string, ProductSummaryAccumulator>();

  records.forEach((record) => {
    if (!record.product_id) {
      return;
    }

    const existing = summaryMap.get(record.product_id);
    const accumulator: ProductSummaryAccumulator = existing ?? {
      productId: record.product_id,
      productName: record.product_name ?? 'Untitled product',
      counters: {
        positive: 0,
        neutral: 0,
        negative: 0,
        mixed: 0,
      },
      totalClassified: 0,
      scoreTotal: 0,
    };

    switch (record.ai_sentiment) {
      case 'positive':
        accumulator.counters.positive += 1;
        break;
      case 'neutral':
        accumulator.counters.neutral += 1;
        break;
      case 'negative':
        accumulator.counters.negative += 1;
        break;
      case 'mixed':
        accumulator.counters.mixed += 1;
        break;
    }

    const confidence = clampConfidence(record.ai_confidence_score);
    accumulator.scoreTotal += deriveSentimentScore(record.ai_sentiment, confidence);
    accumulator.totalClassified += 1;

    summaryMap.set(record.product_id, accumulator);
  });

  return Array.from(summaryMap.values())
    .map((summary) => ({
      productId: summary.productId,
      productName: summary.productName,
      totalClassified: summary.totalClassified,
      sentimentBreakdown: buildSentimentBreakdown(summary.counters, summary.totalClassified),
      averageSentimentScore:
        summary.totalClassified > 0
          ? roundTo(summary.scoreTotal / summary.totalClassified, SCORE_PRECISION)
          : 0,
    }))
    .sort((first, second) => second.totalClassified - first.totalClassified);
}

export async function getFeedbackInsightsForUser(
  userId: string,
  query: InsightsQueryInput,
): Promise<FeedbackInsightsResponse> {
  const now = new Date();
  const scope = await resolveScope(userId, query.sellerId);
  const fromDateIso = resolveTimeframeStart(query.timeframe, now);

  const [totalFeedbackCount, processedFeedback] = await Promise.all([
    countPublishedFeedbackForInsights({ sellerId: scope.sellerId, fromDateIso }),
    fetchProcessedFeedbackForInsights({ sellerId: scope.sellerId, fromDateIso }),
  ]);

  const counters = calculateCounters(processedFeedback);
  const totalClassified = counters.positive + counters.neutral + counters.negative + counters.mixed;
  const perProductSummaries = buildPerProductSummaries(processedFeedback);

  const sortedPositive = processedFeedback
    .filter((record) => record.ai_sentiment === 'positive')
    .sort((first, second) => {
      const confidenceDiff =
        clampConfidence(second.ai_confidence_score) - clampConfidence(first.ai_confidence_score);
      if (confidenceDiff !== 0) {
        return confidenceDiff;
      }

      return new Date(second.created_at).getTime() - new Date(first.created_at).getTime();
    })
    .slice(0, MAX_HIGHLIGHTS)
    .map(toHighlight);

  const sortedNegative = processedFeedback
    .filter((record) => record.ai_sentiment === 'negative')
    .sort((first, second) => {
      const confidenceDiff =
        clampConfidence(second.ai_confidence_score) - clampConfidence(first.ai_confidence_score);
      if (confidenceDiff !== 0) {
        return confidenceDiff;
      }

      return new Date(second.created_at).getTime() - new Date(first.created_at).getTime();
    })
    .slice(0, MAX_HIGHLIGHTS)
    .map(toHighlight);

  return {
    timeframe: query.timeframe,
    scope: {
      level: scope.sellerId ? 'seller' : 'platform',
      sellerId: scope.sellerId,
    },
    generatedAt: now.toISOString(),
    totalFeedbackCount,
    sentimentBreakdown: {
      totalClassified,
      ...buildSentimentBreakdown(counters, totalClassified),
    },
    averageSentimentScore: calculateAverageSentimentScore(processedFeedback),
    perProductSummaries,
    highlights: {
      positive: sortedPositive,
      negative: sortedNegative,
    },
    trend: buildTrend(query.timeframe, processedFeedback, now),
  };
}
