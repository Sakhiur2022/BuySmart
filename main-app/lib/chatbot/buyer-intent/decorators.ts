import type { BuyerIntentResult } from '@/lib/chatbot/buyer-intent/errors';
import type { ToolContract } from '@/lib/chatbot/buyer-intent/tool-contracts';

export type ToolExecutor<TInput, TOutput> = (input: TInput) => Promise<TOutput> | TOutput;

export function withToolValidation<TInput, TOutput>(
  contract: ToolContract<TInput, TOutput>,
  executor: ToolExecutor<TInput, TOutput>,
): ToolExecutor<TInput, BuyerIntentResult<TOutput>> {
  return async (input: TInput) => {
    const parsedInput = contract.inputSchema.safeParse(input);
    if (!parsedInput.success) {
      const issue = parsedInput.error.issues[0];
      return {
        success: false,
        error: {
          code: 'INVALID_PAYLOAD',
          message: issue?.message ?? 'Tool input validation failed.',
          fieldPath: issue?.path?.map(String),
        },
      };
    }

    const result = await executor(parsedInput.data);
    const parsedOutput = contract.outputSchema.safeParse(result);
    if (!parsedOutput.success) {
      const issue = parsedOutput.error.issues[0];
      return {
        success: false,
        error: {
          code: 'INVALID_PAYLOAD',
          message: issue?.message ?? 'Tool output validation failed.',
          fieldPath: issue?.path?.map(String),
        },
      };
    }

    return { success: true, value: parsedOutput.data };
  };
}
