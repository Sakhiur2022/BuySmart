import { AgentOrchestrator } from '@/lib/agents/orchestrator';
import { SentimentAgent } from '@/lib/agents/sentiment/sentiment-agent';
import type {
  SentimentAnalysisPayload,
  SentimentAnalysisResult,
} from '@/lib/agents/sentiment/types';
import { categorizeAIError, normalizeAIError } from '@/lib/services/ai/error-handler';
import type { Feedback } from '@/lib/models/feedback.model';
import type {
  FeedbackSentimentAnalysisResult,
  FeedbackSentimentPersistenceInput,
} from '@/lib/types/feedback-sentiment.types';
import { getFeedbackByIdForScope } from '@/lib/services/feedback.service';
import { updateFeedbackSentimentAnalysisById } from '@/lib/repositories/feedback.repository';

const orchestrator = new AgentOrchestrator();
orchestrator.register(new SentimentAgent());
const FEEDBACK_TEXT_REQUIRED_ERROR = 'Feedback text is required for sentiment analysis';

function buildFeedbackText(title: string | null, comment: string | null): string {
  const normalizedTitle = title?.trim() ?? '';
  const normalizedComment = comment?.trim() ?? '';

  if (normalizedTitle && normalizedComment) {
    return `Title: ${normalizedTitle}\nComment: ${normalizedComment}`;
  }

  return normalizedComment || normalizedTitle;
}

function toPersistenceInput(result: SentimentAnalysisResult): FeedbackSentimentPersistenceInput {
  const rawConfidence = Number(result.confidence);
  const fallbackConfidence = Number(result.confidenceScore);
  const resolvedConfidence = Number.isFinite(rawConfidence) ? rawConfidence : fallbackConfidence;
  const confidence = Math.max(0, Math.min(1, resolvedConfidence));

  return {
    ai_sentiment: result.label,
    ai_confidence_score: confidence,
    ai_category: result.category,
    ai_urgency: result.urgency,
    ai_keywords: result.keySignals,
    ai_processed_at: new Date().toISOString(),
  };
}

export async function analyzeFeedbackSentimentForScope(
  userId: string,
  feedbackId: string,
): Promise<FeedbackSentimentAnalysisResult> {
  const feedback = await getFeedbackByIdForScope(userId, feedbackId);
  const text = buildFeedbackText(feedback.title, feedback.comment);

  if (!text.trim()) {
    throw new Error(FEEDBACK_TEXT_REQUIRED_ERROR);
  }

  let agentResult;

  try {
    const payload: SentimentAnalysisPayload = {
      feedbackId: feedback.feedback_id,
      feedbackType: feedback.feedback_type,
      title: feedback.title,
      text,
    };

    agentResult = await orchestrator.dispatch<SentimentAnalysisPayload, SentimentAnalysisResult>(
      'sentiment',
      payload,
      { userId },
    );
  } catch (error) {
    const normalized = normalizeAIError(error);
    const category = categorizeAIError(normalized);
    throw new Error(`AI_ANALYSIS_FAILED:${category}:${normalized.message}`);
  }

  if (!agentResult.success) {
    throw new Error(
      `AI_ANALYSIS_FAILED:provider:${agentResult.errorMessage ?? 'Sentiment analysis failed'}`,
    );
  }

  const persisted = await updateFeedbackSentimentAnalysisById(
    feedback.feedback_id,
    toPersistenceInput(agentResult.result),
  );

  return {
    feedback: persisted,
    analysis: {
      feedbackId: feedback.feedback_id,
      label: agentResult.result.label,
      sentiment: agentResult.result.sentiment,
      score: agentResult.result.score,
      confidence: agentResult.result.confidence,
      confidenceScore: agentResult.result.confidenceScore,
      category: agentResult.result.category,
      urgency: agentResult.result.urgency,
      reasoningSummary: agentResult.result.reasoningSummary,
      keySignals: agentResult.result.keySignals,
      model: agentResult.model,
      latencyMs: agentResult.latencyMs,
      cached: agentResult.cached,
    },
  };
}

function isNonBlockingSubmissionAnalysisError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message === FEEDBACK_TEXT_REQUIRED_ERROR ||
    error.message.startsWith('AI_ANALYSIS_FAILED:')
  );
}

export async function analyzeFeedbackSentimentForCreatedFeedback(
  userId: string,
  feedback: Feedback,
): Promise<Feedback> {
  try {
    const analyzed = await analyzeFeedbackSentimentForScope(userId, feedback.feedback_id);
    return analyzed.feedback;
  } catch (error) {
    if (isNonBlockingSubmissionAnalysisError(error)) {
      return feedback;
    }

    throw error;
  }
}
