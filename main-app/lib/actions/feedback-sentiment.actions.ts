'use server';

import { analyzeFeedbackSentiment } from '@/lib/controllers/feedback.controller';
import type { FeedbackSentimentAnalysisResult } from '@/lib/types/feedback-sentiment.types';
import { createClient } from '@/lib/supabase/server';

type FeedbackSentimentActionResult =
  | { success: true; data: FeedbackSentimentAnalysisResult; error: null }
  | { success: false; data: null; error: string };

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('Session expired. Please log in again.');
  }

  return user.id;
}

function formatActionError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export async function analyzeFeedbackSentimentAction(
  feedbackId: string,
): Promise<FeedbackSentimentActionResult> {
  try {
    const userId = await requireUserId();
    const data = await analyzeFeedbackSentiment(userId, feedbackId);

    return { success: true, data, error: null };
  } catch (error: unknown) {
    return {
      success: false,
      data: null,
      error: formatActionError(error, 'Failed to analyze feedback sentiment'),
    };
  }
}
