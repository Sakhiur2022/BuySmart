import { PromptTemplate } from '@langchain/core/prompts';
import type { StringPromptValueInterface } from '@langchain/core/prompt_values';
import { RunnableLambda } from '@langchain/core/runnables';
// import { ChatGroq } from '@langchain/groq';

import { aiModels } from '@/lib/services/ai/config';
import { generateText } from '@/lib/services/ai/models/llm';
import type { AITextGenerationResponse } from '@/lib/types/ai.types';

export function createGroqCompletionChain(systemInstruction: string) {
  const escapedSystemInstruction = systemInstruction.replaceAll('{', '{{').replaceAll('}', '}}');

  const prompt = PromptTemplate.fromTemplate(
    `${escapedSystemInstruction}\n\nUser:\n{input}\n\nAssistant:`,
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

/**
 * Alternative implementation using ChatGroq directly from @langchain/groq
 * Uncomment to use instead of the above
 */
/*
export function createGroqCompletionChain(systemInstruction: string) {
  const model = new ChatGroq({
    modelName: aiModels.chat.id,
    temperature: aiModels.chat.temperature,
    maxTokens: aiModels.chat.maxTokens,
    topP: aiModels.chat.topP,
  });

  const systemPrompt = PromptTemplate.fromTemplate(
    `${systemInstruction.replaceAll("{", "{{").replaceAll("}", "}}")}`,
  );

  const prompt = PromptTemplate.fromTemplate("{system}\n\nUser:\n{input}\n\nAssistant:");

  const runnable = systemPrompt.pipe(
    (systemOutput) =>
      prompt.pipe(
        async (promptOutput) => {
          const response = await model.invoke([
            { role: "system", content: systemOutput },
            { role: "user", content: promptOutput.toString() },
          ]);
          return {
            text: response.content as string,
            model: aiModels.chat.id,
            usage: {
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
            },
          };
        },
      ),
  );

  return runnable;
}
*/
