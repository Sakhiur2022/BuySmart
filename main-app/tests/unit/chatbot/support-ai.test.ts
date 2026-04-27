import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/services/ai/config', () => ({
  isAIConfigured: vi.fn(),
}));

vi.mock('@/lib/services/ai/models/llm', () => ({
  generateChatCompletion: vi.fn(),
}));

import { answerProductSearchQuestion, answerSupportQuestion } from '@/lib/chatbot/support-ai';
import { isAIConfigured } from '@/lib/services/ai/config';
import { generateChatCompletion } from '@/lib/services/ai/models/llm';

describe('answerSupportQuestion', () => {
  beforeEach(() => {
    vi.mocked(isAIConfigured).mockReset();
    vi.mocked(generateChatCompletion).mockReset();
  });

  it('returns a conservative fallback when AI is not configured', async () => {
    vi.mocked(isAIConfigured).mockReturnValue(false);

    const result = await answerSupportQuestion('How do I checkout?', {
      category: null,
      price_max: null,
      lastOrderId: null,
      history: [],
    });

    expect(result).toEqual({
      reply: 'Use Add to Cart first, then open Your Cart and tap Checkout.',
      shouldEscalate: false,
    });
  });

  it('parses structured AI output when AI is configured', async () => {
    vi.mocked(isAIConfigured).mockReturnValue(true);
    vi.mocked(generateChatCompletion).mockResolvedValue({
      text: '{"reply":"Use Products to browse the catalog.","shouldEscalate":false}',
      model: 'mock-model',
      usage: {
        promptTokens: 1,
        completionTokens: 1,
        totalTokens: 2,
      },
    });

    const result = await answerSupportQuestion('Where do I browse items?', {
      category: null,
      price_max: null,
      lastOrderId: null,
      history: [],
    });

    expect(result).toEqual({
      reply: 'Use Products to browse the catalog.',
      shouldEscalate: false,
    });
  });

  it('returns a natural fallback for product search replies when AI is not configured', async () => {
    vi.mocked(isAIConfigured).mockReturnValue(false);

    const result = await answerProductSearchQuestion(
      'Need a phone under 20000',
      [
        {
          id: 'p1',
          name: 'Redmi Note 13 Pro',
          price: 18999,
          category: 'phone',
          images: [],
          stock_available: true,
          features: ['gaming'],
          badge: 'Best battery',
        },
      ],
      {
        category: 'phone',
        price_max: 20000,
        features: ['gaming'],
      },
    );

    expect(result).toEqual({
      reply: 'I found a few phones under BDT 20,000 with gaming options. Here are some good matches.',
    });
  });

  it('uses BDT wording for empty product search fallback replies too', async () => {
    vi.mocked(isAIConfigured).mockReturnValue(false);

    const result = await answerProductSearchQuestion(
      'any phone under 2000',
      [],
      {
        category: 'phone',
        price_max: 2000,
        features: [],
      },
    );

    expect(result).toEqual({
      reply: "I couldn't find any phones under BDT 2,000. Try a broader search or a higher budget.",
    });
  });
});
