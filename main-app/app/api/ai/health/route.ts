import { NextResponse } from "next/server";

import { aiModels } from "@/lib/services/ai/config";
import { testHuggingFaceConnection } from "@/lib/services/ai/test-connection";
import { testAllAIModels } from "@/lib/services/ai/test-models";

export async function GET() {
  const connection = await testHuggingFaceConnection();
  const report = await testAllAIModels();

  return NextResponse.json({
    ok: connection.ok && report.ok,
    models: {
      llm: aiModels.llm.id,
      chat: aiModels.chat.id,
      embeddings: aiModels.embeddings.id,
      sentiment: aiModels.sentiment.id,
      classification: aiModels.classification.id,
    },
    connection,
    report,
  });
}
