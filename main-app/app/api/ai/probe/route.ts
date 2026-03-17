import { NextResponse } from 'next/server';

import { invokeGroqModel, type GroqTextGenerationPayload } from '@/lib/services/ai/groq-client';

const DEFAULT_MODELS = ['openai/gpt-oss-120b', 'mixtral-8x7b-32768', 'llama2-70b-4096'];

const SAMPLE_PAYLOAD: GroqTextGenerationPayload = {
  messages: [
    {
      role: 'user',
      content: "Say 'Hello'",
    },
  ],
  max_tokens: 16,
};

async function probeModel(model: string) {
  try {
    await invokeGroqModel<Record<string, unknown>>(model, SAMPLE_PAYLOAD, { timeoutMs: 12000 });

    return { model, ok: true };
  } catch (error) {
    return {
      model,
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const modelsParam = url.searchParams.get('models');
  const candidates = modelsParam
    ? modelsParam
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    : DEFAULT_MODELS;

  const results = [];
  for (const model of candidates) {
    results.push(await probeModel(model));
  }

  return NextResponse.json({
    ok: results.some((result) => result.ok),
    results,
  });
}
