import { aiModels } from '@/lib/services/ai/config';
import { invokeGroqModel, type GroqTextGenerationPayload } from '@/lib/services/ai/groq-client';
import { AIRequestError, AIResponseError } from '@/lib/services/ai/error-handler';
import type { AISentimentLabel, AISentimentResponse } from '@/lib/types/ai.types';

interface GroqSentimentResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

function mapLabel(rawLabel: string): AISentimentLabel {
  const normalized = rawLabel.toLowerCase().trim();

  if (normalized.includes('neg')) {
    return 'negative';
  }

  if (normalized.includes('neu')) {
    return 'neutral';
  }

  if (normalized.includes('mix')) {
    return 'mixed';
  }

  return 'positive';
}

export async function analyzeSentiment(text: string): Promise<AISentimentResponse> {
  if (!text.trim()) {
    throw new AIRequestError('Sentiment input must be a non-empty string.');
  }

  const systemPrompt = `You are a sentiment analysis assistant. Analyze the given text and respond with a JSON object containing:
{
  "sentiment": "positive" | "negative" | "neutral" | "mixed",
  "confidence": <0.0-1.0>,
  "reasoning": "<brief explanation>"
}

Guidelines:
- positive: text expresses satisfaction, joy, approval, or positive emotion
- negative: text expresses dissatisfaction, anger, disapproval, or negative emotion
- neutral: text is factual, objective, without emotional judgment
- mixed: text contains both positive and negative sentiments`;

  const userPrompt = `Analyze sentiment: "${text}"`;

  const payload: GroqTextGenerationPayload = {
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    temperature: 0.3,
    max_tokens: 200,
  };

  const raw = await invokeGroqModel<GroqSentimentResponse>(aiModels.chat.id, payload, {
    cache: true,
    cacheTtlMs: 10 * 60 * 1000,
  });

  const responseText = raw.choices[0]?.message?.content;

  if (!responseText) {
    throw new AIResponseError('Groq sentiment analysis response is empty.');
  }

  try {
    const parsed = JSON.parse(responseText);

    const label = mapLabel(parsed.sentiment);
    const confidence = Math.max(0, Math.min(1, parsed.confidence || 0.5));

    return {
      label,
      confidence,
      rawLabel: parsed.sentiment,
      model: aiModels.chat.id,
    };
  } catch {
    throw new AIResponseError(`Failed to parse Groq sentiment response: ${responseText}`);
  }
}
