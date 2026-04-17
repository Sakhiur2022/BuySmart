import type {
  CreateFeedbackInput,
  Feedback,
  FeedbackListFilters,
  FeedbackListResult,
  UpdateFeedbackInput,
} from '@/lib/models/feedback.model';
import type { FeedbackSentimentAnalysisResult } from '@/lib/types/feedback-sentiment.types';
import {
  createFeedbackForUser,
  getFeedbackByIdForScope,
  listFeedbackForScope,
  softDeleteFeedbackForScope,
  updateFeedbackForScope,
} from '@/lib/services/feedback.service';
import {
  analyzeFeedbackSentimentForCreatedFeedback,
  analyzeFeedbackSentimentForScope,
} from '@/lib/services/feedback-analysis.service';

export async function getFeedbackList(
  userId: string,
  filters: FeedbackListFilters,
): Promise<FeedbackListResult> {
  return listFeedbackForScope(userId, filters);
}

export async function getFeedbackById(userId: string, feedbackId: string): Promise<Feedback> {
  return getFeedbackByIdForScope(userId, feedbackId);
}

export async function createFeedback(
  userId: string,
  input: CreateFeedbackInput,
): Promise<Feedback> {
  const created = await createFeedbackForUser(userId, input);
  return analyzeFeedbackSentimentForCreatedFeedback(userId, created);
}

export async function updateFeedback(
  userId: string,
  feedbackId: string,
  input: UpdateFeedbackInput,
): Promise<Feedback> {
  return updateFeedbackForScope(userId, feedbackId, input);
}

export async function deleteFeedback(userId: string, feedbackId: string): Promise<Feedback> {
  return softDeleteFeedbackForScope(userId, feedbackId);
}

export async function analyzeFeedbackSentiment(
  userId: string,
  feedbackId: string,
): Promise<FeedbackSentimentAnalysisResult> {
  return analyzeFeedbackSentimentForScope(userId, feedbackId);
}
