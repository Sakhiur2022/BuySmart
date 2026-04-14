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
        label: 'positive',
        score: 0.9,
        confidence: 0.9,
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
    expect(result.result.label).toBe('positive');
    expect(result.result.sentiment).toBe('positive');
    expect(result.result.score).toBe(0.9);
    expect(result.result.confidence).toBe(0.9);
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
    expect(result.result.label).toBe('neutral');
    expect(result.result.sentiment).toBe('neutral');
    expect(result.result.score).toBe(0);
    expect(result.result.confidence).toBe(0);
    expect(result.result.confidenceScore).toBe(0);
  });

  it('normalizes mixed output to zero signed score', async () => {
    mockGroqChainSuccess(
      JSON.stringify({
        sentiment: 'mixed',
        confidenceScore: 0.62,
        category: 'delivery',
        urgency: 'medium',
        reasoningSummary: 'Delivery had both positive and negative signals.',
        keySignals: ['arrived late', 'support was helpful'],
      }),
      'mocked-groq-model',
    );

    const agent = new SentimentAgent();

    const result = await agent.run({
      task: 'analyze_sentiment',
      payload: {
        feedbackId: 'fd-feedback-3',
        feedbackType: 'service_feedback',
        text: 'The package was late but support handled it well',
      },
    });

    expect(result.success).toBe(true);
    expect(result.result.label).toBe('mixed');
    expect(result.result.score).toBe(0);
    expect(result.result.confidence).toBe(0.62);
  });

  it('normalizes positive/negative score sign from explicit score', async () => {
    mockGroqChainSuccess(
      JSON.stringify({
        sentiment: 'negative',
        score: 0.7,
        confidence: 0.8,
        category: 'delivery',
        urgency: 'medium',
        reasoningSummary: 'Customer is unhappy with delivery delays.',
        keySignals: ['late delivery'],
      }),
      'mocked-groq-model',
    );

    const agent = new SentimentAgent();

    const result = await agent.run({
      task: 'analyze_sentiment',
      payload: {
        feedbackId: 'fd-feedback-4',
        feedbackType: 'service_feedback',
        text: 'Delivery took too long and was frustrating',
      },
    });

    expect(result.success).toBe(true);
    expect(result.result.label).toBe('negative');
    expect(result.result.score).toBe(-0.7);
    expect(result.result.confidence).toBe(0.8);
  });

  it('parses JSON from fenced code block output', async () => {
    mockGroqChainSuccess(
      `\n\`\`\`json\n{\n  \"sentiment\": \"positive\",\n  \"confidenceScore\": 0.95,\n  \"category\": \"product_quality\",\n  \"urgency\": \"low\",\n  \"reasoningSummary\": \"User clearly expresses satisfaction.\",\n  \"keySignals\": [\"excellent quality\"]\n}\n\`\`\``,
    );

    const agent = new SentimentAgent();
    const result = await agent.run({
      task: 'analyze_sentiment',
      payload: {
        feedbackId: 'fd-feedback-5',
        feedbackType: 'product_review',
        text: 'Excellent quality and performance',
      },
    });

    expect(result.success).toBe(true);
    expect(result.result.label).toBe('positive');
    expect(result.result.score).toBe(0.95);
    expect(result.result.confidenceScore).toBe(0.95);
  });

  it('parses JSON from brace-extracted text and normalizes neutral score', async () => {
    mockGroqChainSuccess(
      'model output start {"sentiment":"neutral","score":0.4,"confidence":0.4,"category":"other","urgency":"low","reasoningSummary":"Balanced factual tone.","keySignals":["factual"]} model output end',
      'mocked-groq-model',
    );

    const agent = new SentimentAgent();
    const result = await agent.run({
      task: 'analyze_sentiment',
      payload: {
        feedbackId: 'fd-feedback-6',
        feedbackType: 'general_feedback',
        text: 'The order was delivered yesterday.',
      },
    });

    expect(result.success).toBe(true);
    expect(result.result.label).toBe('neutral');
    expect(result.result.score).toBe(0);
  });

  it('handles blank payload text without cache key and still parses output', async () => {
    mockGroqChainSuccess(
      JSON.stringify({
        sentiment: 'positive',
        confidenceScore: 0.52,
        category: 'other',
        urgency: 'low',
        reasoningSummary: 'Positive signal identified.',
        keySignals: ['positive wording'],
      }),
      'mocked-groq-model',
    );

    const agent = new SentimentAgent();
    const result = await agent.run({
      task: 'analyze_sentiment',
      payload: {
        feedbackId: 'fd-feedback-7',
        feedbackType: 'general_feedback',
        text: '   ',
      },
    });

    expect(result.success).toBe(true);
    expect(result.result.label).toBe('positive');
    expect(result.result.score).toBe(0.52);
  });
});
