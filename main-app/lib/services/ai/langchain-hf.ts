import { PromptTemplate } from "@langchain/core/prompts";
import type { StringPromptValueInterface } from "@langchain/core/prompt_values";
import { RunnableLambda } from "@langchain/core/runnables";

import { aiModels } from "@/lib/services/ai/config";
import { generateText } from "@/lib/services/ai/models/llm";
import type { AITextGenerationResponse } from "@/lib/types/ai.types";

export function createHFCompletionChain(systemInstruction: string) {
  const prompt = PromptTemplate.fromTemplate(
    `${systemInstruction}\n\nUser:\n{input}\n\nAssistant:`,
  );

  const runnable = RunnableLambda.from(
    async (promptValue: StringPromptValueInterface): Promise<AITextGenerationResponse> => {
      const formattedPrompt = promptValue.toString();

      const response = await generateText({
        prompt: formattedPrompt,
        model: aiModels.chat.id,
      });

      return response;
    },
  );

  return prompt.pipe(runnable);
}
