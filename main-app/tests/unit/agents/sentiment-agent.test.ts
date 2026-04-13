import { describe, expect, it, vi } from 'vitest';

import { SentimentAgent } from '@/lib/agents/sentiment/sentiment-agent';
import {
  createGroqCompletionChainMock,
  invokeGroqChainMock,
  mockGroqChainSuccess,
} from '@/tests/mocks/langchain';

vi.mock('@/lib/services/ai/langchain-groq', () => ({
  createGroqCompletionChain: vi.fn(() => createGroqCompletionChainMock()),
}));

describe('SentimentAgent', () => {
  it('parses successful JSON output from chain response', async () => {
    mockGroqChainSuccess(
      JSON.stringify({
        sentiment: 'positive',
        confidenceScore: 0.9,
        category: 'product_quality',
        urgency: 'low',
        reasoningSummary: 'Customer reports a positive product experience.',
        keySignals: ['great quality', 'recommended'],
      }),
      'mocked-groq-model',
    );

    const agent = new SentimentAgent();

    const result = await agent.run({
      task: 'analyze_sentiment',
      payload: {
        feedbackId: 'fd-feedback-1',
        feedbackType: 'product_review',
        text: 'Great quality and fast shipping',
      },
      context: { userId: 'user-1' },
    });

    expect(invokeGroqChainMock).toHaveBeenCalledOnce();
    expect(result.success).toBe(true);
    expect(result.result.sentiment).toBe('positive');
    expect(result.model).toBe('mocked-groq-model');
  });

  it('falls back to neutral result for non-JSON provider output', async () => {
    mockGroqChainSuccess('Provider timed out; try again later.');

    const agent = new SentimentAgent();

    const result = await agent.run({
      task: 'analyze_sentiment',
      payload: {
        feedbackId: 'fd-feedback-2',
        feedbackType: 'service_feedback',
        text: 'No useful content from model',
      },
    });

    expect(result.success).toBe(true);
    expect(result.result.sentiment).toBe('neutral');
    expect(result.result.confidenceScore).toBe(0);
  });
});
