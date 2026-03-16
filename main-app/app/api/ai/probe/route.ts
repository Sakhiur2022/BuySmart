import { NextResponse } from "next/server";

import { invokeHuggingFaceModel } from "@/lib/services/ai/hf-client";

const DEFAULT_MODELS = [
  "bigscience/bloom-560m",
  "EleutherAI/gpt-neo-125M",
  "EleutherAI/gpt-neo-1.3B",
  "tiiuae/falcon-7b-instruct",
  "HuggingFaceH4/zephyr-7b-beta",
];

const SAMPLE_PAYLOAD = {
  inputs: "Hello",
  parameters: {
    max_new_tokens: 8,
    return_full_text: false,
  },
};

async function probeModel(model: string) {
  try {
    await invokeHuggingFaceModel<Record<string, unknown> | unknown[]>(
      model,
      SAMPLE_PAYLOAD,
      { timeoutMs: 12000 },
    );

    return { model, ok: true };
  } catch (error) {
    return {
      model,
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const modelsParam = url.searchParams.get("models");
  const candidates = modelsParam
    ? modelsParam
        .split(",")
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
