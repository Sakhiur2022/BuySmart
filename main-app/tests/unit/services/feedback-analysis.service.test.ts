import { describe, expect, it, vi } from 'vitest';

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

import { analyzeFeedbackSentimentForScope } from '@/lib/services/feedback-analysis.service';
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
    expect(result.analysis.sentiment).toBe('positive');
  });
});
