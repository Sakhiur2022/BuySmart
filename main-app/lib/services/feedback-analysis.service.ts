import { AgentOrchestrator } from '@/lib/agents/orchestrator';
import { SentimentAgent } from '@/lib/agents/sentiment/sentiment-agent';
import type {
  SentimentAnalysisPayload,
  SentimentAnalysisResult,
} from '@/lib/agents/sentiment/types';
import { normalizeAIError } from '@/lib/services/ai/error-handler';
import type {
  FeedbackSentimentAnalysisResult,
  FeedbackSentimentPersistenceInput,
} from '@/lib/types/feedback-sentiment.types';
import { getFeedbackByIdForScope } from '@/lib/services/feedback.service';
import { updateFeedbackSentimentAnalysisById } from '@/lib/repositories/feedback.repository';

const orchestrator = new AgentOrchestrator();
orchestrator.register(new SentimentAgent());

function buildFeedbackText(title: string | null, comment: string | null): string {
  const normalizedTitle = title?.trim() ?? '';
  const normalizedComment = comment?.trim() ?? '';

  if (normalizedTitle && normalizedComment) {
    return `Title: ${normalizedTitle}\nComment: ${normalizedComment}`;
  }

  return normalizedComment || normalizedTitle;
}

function toPersistenceInput(result: SentimentAnalysisResult): FeedbackSentimentPersistenceInput {
  return {
    ai_sentiment: result.sentiment,
    ai_confidence_score: Math.max(0, Math.min(1, Number(result.confidenceScore))),
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
    throw new Error('Feedback text is required for sentiment analysis');
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
    throw new Error(`AI_ANALYSIS_FAILED:${normalized.message}`);
  }

  if (!agentResult.success) {
    throw new Error(
      `AI_ANALYSIS_FAILED:${agentResult.errorMessage ?? 'Sentiment analysis failed'}`,
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
      sentiment: agentResult.result.sentiment,
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
