import { aiModels } from '@/lib/services/ai/config';
import { invokeGroqModel, type GroqTextGenerationPayload } from '@/lib/services/ai/groq-client';
import { AIRequestError, AIResponseError } from '@/lib/services/ai/error-handler';
import type { AIClassificationResponse } from '@/lib/types/ai.types';

interface GroqClassificationResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface ClassifyInput {
  text: string;
  candidateLabels: string[];
  multiLabel?: boolean;
}

export async function classifyText(input: ClassifyInput): Promise<AIClassificationResponse> {
  if (!input.text.trim()) {
    throw new AIRequestError('Classification input text must be a non-empty string.');
  }

  const normalizedLabels = input.candidateLabels
    .map((label) => label.trim())
    .filter((label) => Boolean(label));

  if (normalizedLabels.length === 0) {
    throw new AIRequestError('Classification requires at least one candidate label.');
  }

  const labelsText = normalizedLabels.join(', ');
  const multiLabelText = input.multiLabel ? 'multiple' : 'one';

  const systemPrompt = `You are a text classification assistant. Classify the given text into the provided categories. Respond with a JSON object containing: {"classification": "<selected_label>", "confidence": <0.0-1.0>, "all_scores": {"label1": score1, ...}}. If multi-label, respond with {"classifications": ["label1", "label2", ...], "scores": {"label1": score1, ...}}`;

  const userPrompt = `Classify this text into ${multiLabelText} of these categories: ${labelsText}\n\nText: "${input.text}"`;

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

  const raw = await invokeGroqModel<GroqClassificationResponse>(aiModels.chat.id, payload, {
    cache: true,
    cacheTtlMs: 10 * 60 * 1000,
  });

  const responseText = raw.choices[0]?.message?.content;

  if (!responseText) {
    throw new AIResponseError('Groq classification response is empty.');
  }

  try {
    const parsed = JSON.parse(responseText);

    if (input.multiLabel && parsed.classifications) {
      const scores = parsed.scores || {};
      const labels = parsed.classifications || [];
      const scoresArray = labels.map((label: string) => scores[label] || 0.5);

      return {
        labels,
        scores: scoresArray,
        topLabel: labels[0],
        topScore: scoresArray[0],
        model: aiModels.chat.id,
      };
    } else {
      const label = parsed.classification || normalizedLabels[0];
      const confidence = parsed.confidence || 0.5;

      return {
        labels: [label],
        scores: [confidence],
        topLabel: label,
        topScore: confidence,
        model: aiModels.chat.id,
      };
    }
  } catch {
    throw new AIResponseError(`Failed to parse Groq classification response: ${responseText}`);
  }
}
