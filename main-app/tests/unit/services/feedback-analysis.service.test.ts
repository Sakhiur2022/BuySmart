import { describe, expect, it, vi } from 'vitest';
import { AIRequestError } from '@/lib/services/ai/error-handler';

import { buildFeedback, buildSentimentAgentOutput } from '@/tests/factories/feedback.factory';

const { dispatchMock } = vi.hoisted(() => ({
  dispatchMock: vi.fn(),
}));

vi.mock('@/lib/agents/orchestrator', () => ({
  AgentOrchestrator: class {
    register = vi.fn();
    dispatch = dispatchMock;
  },
}));

vi.mock('@/lib/services/feedback.service', () => ({
  getFeedbackByIdForScope: vi.fn(),
}));

vi.mock('@/lib/repositories/feedback.repository', () => ({
  updateFeedbackSentimentAnalysisById: vi.fn(),
}));

import {
  analyzeFeedbackSentimentForCreatedFeedback,
  analyzeFeedbackSentimentForScope,
} from '@/lib/services/feedback-analysis.service';
import { getFeedbackByIdForScope } from '@/lib/services/feedback.service';
import { updateFeedbackSentimentAnalysisById } from '@/lib/repositories/feedback.repository';

describe('analyzeFeedbackSentimentForScope', () => {
  it('fetches feedback, dispatches sentiment agent, and persists result', async () => {
    const feedback = buildFeedback();
    const agentOutput = buildSentimentAgentOutput();

    vi.mocked(getFeedbackByIdForScope).mockResolvedValue(feedback);
    dispatchMock.mockResolvedValue({
      success: true,
      result: agentOutput,
      model: 'mocked-groq-model',
      latencyMs: 35,
      cached: false,
    });
    vi.mocked(updateFeedbackSentimentAnalysisById).mockResolvedValue(feedback);

    const result = await analyzeFeedbackSentimentForScope('user-test-1', feedback.feedback_id);

    expect(getFeedbackByIdForScope).toHaveBeenCalledWith('user-test-1', feedback.feedback_id);
    expect(dispatchMock).toHaveBeenCalledOnce();
    expect(updateFeedbackSentimentAnalysisById).toHaveBeenCalledOnce();
    expect(result.feedback.feedback_id).toBe(feedback.feedback_id);
    expect(result.analysis.label).toBe('positive');
    expect(result.analysis.sentiment).toBe('positive');
    expect(result.analysis.score).toBe(0.92);
    expect(result.analysis.confidence).toBe(0.92);
    expect(result.analysis.confidenceScore).toBe(0.92);
  });

  it('throws when feedback text is empty', async () => {
    const feedback = buildFeedback({ title: '   ', comment: '   ' });
    vi.mocked(getFeedbackByIdForScope).mockResolvedValue(feedback);

    await expect(
      analyzeFeedbackSentimentForScope('user-test-1', feedback.feedback_id),
    ).rejects.toThrow('Feedback text is required for sentiment analysis');
  });

  it('wraps orchestrator exceptions with AI_ANALYSIS_FAILED', async () => {
    const feedback = buildFeedback();
    vi.mocked(getFeedbackByIdForScope).mockResolvedValue(feedback);
    dispatchMock.mockRejectedValue(new Error('transport failed'));

    await expect(
      analyzeFeedbackSentimentForScope('user-test-1', feedback.feedback_id),
    ).rejects.toThrow('AI_ANALYSIS_FAILED:provider:transport failed');
  });

  it('classifies request timeout failures with timeout category', async () => {
    const feedback = buildFeedback();
    vi.mocked(getFeedbackByIdForScope).mockResolvedValue(feedback);
    dispatchMock.mockRejectedValue(new AIRequestError('provider timed out', 504));

    await expect(
      analyzeFeedbackSentimentForScope('user-test-1', feedback.feedback_id),
    ).rejects.toThrow('AI_ANALYSIS_FAILED:timeout:provider timed out');
  });

  it('throws when orchestrator returns unsuccessful result', async () => {
    const feedback = buildFeedback();
    vi.mocked(getFeedbackByIdForScope).mockResolvedValue(feedback);
    dispatchMock.mockResolvedValue({
      success: false,
      result: buildSentimentAgentOutput({
        label: 'neutral',
        sentiment: 'neutral',
        score: 0,
        confidence: 0,
        confidenceScore: 0,
      }),
      errorMessage: 'low confidence',
    });

    await expect(
      analyzeFeedbackSentimentForScope('user-test-1', feedback.feedback_id),
    ).rejects.toThrow('AI_ANALYSIS_FAILED:provider:low confidence');
  });

  it('uses default failure message when unsuccessful result has no errorMessage', async () => {
    const feedback = buildFeedback({ title: null, comment: 'Only comment text' });
    vi.mocked(getFeedbackByIdForScope).mockResolvedValue(feedback);
    dispatchMock.mockResolvedValue({
      success: false,
      result: buildSentimentAgentOutput({
        label: 'neutral',
        sentiment: 'neutral',
        score: 0,
        confidence: 0,
        confidenceScore: 0,
      }),
    });

    await expect(
      analyzeFeedbackSentimentForScope('user-test-1', feedback.feedback_id),
    ).rejects.toThrow('AI_ANALYSIS_FAILED:provider:Sentiment analysis failed');
  });

  it('persists confidence from confidenceScore when confidence is missing', async () => {
    const feedback = buildFeedback({ title: null, comment: 'Comment-only payload' });
    const agentOutput = buildSentimentAgentOutput({
      confidence: Number.NaN,
      confidenceScore: 0.61,
      score: 0.61,
    });

    vi.mocked(getFeedbackByIdForScope).mockResolvedValue(feedback);
    dispatchMock.mockResolvedValue({
      success: true,
      result: agentOutput,
      model: 'mocked-groq-model',
      latencyMs: 20,
      cached: false,
    });
    vi.mocked(updateFeedbackSentimentAnalysisById).mockResolvedValue(feedback);

    await analyzeFeedbackSentimentForScope('user-test-1', feedback.feedback_id);

    expect(updateFeedbackSentimentAnalysisById).toHaveBeenCalledWith(
      feedback.feedback_id,
      expect.objectContaining({ ai_confidence_score: 0.61 }),
    );
    expect(dispatchMock).toHaveBeenCalledWith(
      'sentiment',
      expect.objectContaining({ text: 'Comment-only payload' }),
      { userId: 'user-test-1' },
    );
  });

  it('returns analyzed feedback for submit-triggered flow when analysis succeeds', async () => {
    const feedback = buildFeedback();
    const persisted = buildFeedback({
      feedback_id: feedback.feedback_id,
      ai_sentiment: 'positive',
      ai_confidence_score: 0.92,
    });

    vi.mocked(getFeedbackByIdForScope).mockResolvedValue(feedback);
    dispatchMock.mockResolvedValue({
      success: true,
      result: buildSentimentAgentOutput(),
      model: 'mocked-groq-model',
      latencyMs: 25,
      cached: false,
    });
    vi.mocked(updateFeedbackSentimentAnalysisById).mockResolvedValue(persisted);

    const result = await analyzeFeedbackSentimentForCreatedFeedback('user-test-1', feedback);

    expect(result.ai_sentiment).toBe('positive');
  });

  it('returns original feedback for submit-triggered flow when feedback text is empty', async () => {
    const feedback = buildFeedback({ title: ' ', comment: '  ', ai_sentiment: null });
    vi.mocked(getFeedbackByIdForScope).mockResolvedValue(feedback);

    const result = await analyzeFeedbackSentimentForCreatedFeedback('user-test-1', feedback);

    expect(result).toEqual(feedback);
    expect(updateFeedbackSentimentAnalysisById).not.toHaveBeenCalled();
  });

  it('returns original feedback for submit-triggered flow when provider call fails', async () => {
    const feedback = buildFeedback({ ai_sentiment: null });
    vi.mocked(getFeedbackByIdForScope).mockResolvedValue(feedback);
    dispatchMock.mockRejectedValue(new Error('provider unavailable'));

    const result = await analyzeFeedbackSentimentForCreatedFeedback('user-test-1', feedback);

    expect(result).toEqual(feedback);
  });

  it('rethrows non-analysis errors for submit-triggered flow', async () => {
    const feedback = buildFeedback();
    vi.mocked(getFeedbackByIdForScope).mockRejectedValue(new Error('Feedback not found'));

    await expect(
      analyzeFeedbackSentimentForCreatedFeedback('user-test-1', feedback),
    ).rejects.toThrow('Feedback not found');
  });
});
