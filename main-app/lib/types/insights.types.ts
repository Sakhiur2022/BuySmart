import { z } from 'zod';
import type { Database } from '@/lib/types/database.types';

export const INSIGHTS_TIMEFRAME_VALUES = ['7d', '30d', 'all'] as const;
export const insightsTimeframeSchema = z.enum(INSIGHTS_TIMEFRAME_VALUES);

export const insightsQuerySchema = z.object({
  sellerId: z.string().uuid().optional(),
  timeframe: insightsTimeframeSchema.optional().default('30d'),
});

export type InsightsTimeframe = z.infer<typeof insightsTimeframeSchema>;
export type InsightsQueryInput = z.infer<typeof insightsQuerySchema>;

export type FeedbackAISentiment = Database['public']['Enums']['ai_sentiment_enum'];

export interface FeedbackInsightsScope {
  role: Database['public']['Enums']['user_role_enum'];
  sellerId?: string;
  userId: string;
}

export interface SentimentMetric {
  count: number;
  percentage: number;
}

export interface FeedbackHighlight {
  feedbackId: string;
  confidenceScore: number;
  snippet: string;
  createdAt: string;
}

export interface FeedbackTrendPoint {
  periodStart: string;
  total: number;
  positive: number;
  neutral: number;
  negative: number;
  mixed: number;
  averageSentimentScore: number;
}

export interface FeedbackInsightsResponse {
  timeframe: InsightsTimeframe;
  scope: {
    level: 'platform' | 'seller';
    sellerId?: string;
  };
  generatedAt: string;
  totalFeedbackCount: number;
  sentimentBreakdown: {
    totalClassified: number;
    positive: SentimentMetric;
    neutral: SentimentMetric;
    negative: SentimentMetric;
    mixed: SentimentMetric;
  };
  averageSentimentScore: number;
  highlights: {
    positive: FeedbackHighlight[];
    negative: FeedbackHighlight[];
  };
  trend: FeedbackTrendPoint[];
}

const sentimentMetricSchema = z.object({
  count: z.number().int().min(0),
  percentage: z.number().min(0).max(100),
});

const feedbackHighlightSchema = z.object({
  feedbackId: z.string().uuid(),
  confidenceScore: z.number().min(0).max(1),
  snippet: z.string().max(240),
  createdAt: z.string().datetime({ offset: true }),
});

const feedbackTrendPointSchema = z.object({
  periodStart: z.string(),
  total: z.number().int().min(0),
  positive: z.number().int().min(0),
  neutral: z.number().int().min(0),
  negative: z.number().int().min(0),
  mixed: z.number().int().min(0),
  averageSentimentScore: z.number().min(-1).max(1),
});

export const feedbackInsightsResponseSchema = z.object({
  timeframe: insightsTimeframeSchema,
  scope: z.object({
    level: z.enum(['platform', 'seller']),
    sellerId: z.string().uuid().optional(),
  }),
  generatedAt: z.string().datetime({ offset: true }),
  totalFeedbackCount: z.number().int().min(0),
  sentimentBreakdown: z.object({
    totalClassified: z.number().int().min(0),
    positive: sentimentMetricSchema,
    neutral: sentimentMetricSchema,
    negative: sentimentMetricSchema,
    mixed: sentimentMetricSchema,
  }),
  averageSentimentScore: z.number().min(-1).max(1),
  highlights: z.object({
    positive: z.array(feedbackHighlightSchema),
    negative: z.array(feedbackHighlightSchema),
  }),
  trend: z.array(feedbackTrendPointSchema),
});
