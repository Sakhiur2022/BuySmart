import { AgentOrchestrator } from '@/lib/agents/orchestrator';
import { RefundDecisionAgent } from '@/lib/agents/refund/refund-decision-agent';
import {
  refundDecisionInputSchema,
  refundDecisionOutputSchema,
  type RefundDecisionInput,
  type RefundDecisionOutput,
} from '@/lib/agents/refund/types';
import { categorizeAIError } from '@/lib/services/ai/error-handler';

export class RefundDecisionAdapterError extends Error {
  public readonly code:
    | 'REFUND_AI_INPUT_INVALID'
    | 'REFUND_AI_OUTPUT_INVALID'
    | 'REFUND_AI_TIMEOUT'
    | 'REFUND_AI_RATE_LIMIT'
    | 'REFUND_AI_CONFIGURATION'
    | 'REFUND_AI_REQUEST'
    | 'REFUND_AI_PROVIDER';

  public constructor(
    code: RefundDecisionAdapterError['code'],
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'RefundDecisionAdapterError';
    this.code = code;
  }
}

export interface IRefundDecisionAdapter {
  getRefundRecommendation(
    input: RefundDecisionInput,
    context?: { userId?: string },
  ): Promise<RefundDecisionOutput>;
}

function toAdapterError(error: unknown): RefundDecisionAdapterError {
  const category = categorizeAIError(error);

  if (category === 'timeout') {
    return new RefundDecisionAdapterError(
      'REFUND_AI_TIMEOUT',
      'Refund AI request timed out',
      error,
    );
  }

  if (category === 'rate_limit') {
    return new RefundDecisionAdapterError(
      'REFUND_AI_RATE_LIMIT',
      'Refund AI provider rate limited',
      error,
    );
  }

  if (category === 'configuration') {
    return new RefundDecisionAdapterError(
      'REFUND_AI_CONFIGURATION',
      'Refund AI is not configured correctly',
      error,
    );
  }

  if (category === 'request') {
    return new RefundDecisionAdapterError('REFUND_AI_REQUEST', 'Refund AI request failed', error);
  }

  return new RefundDecisionAdapterError('REFUND_AI_PROVIDER', 'Refund AI provider failed', error);
}

export class RefundDecisionAdapterService implements IRefundDecisionAdapter {
  private readonly orchestrator: AgentOrchestrator;

  public constructor(orchestrator?: AgentOrchestrator) {
    this.orchestrator = orchestrator ?? new AgentOrchestrator();

    if (!this.orchestrator.getAgent('refund-decision')) {
      this.orchestrator.register(new RefundDecisionAgent());
    }
  }

  public async getRefundRecommendation(
    input: RefundDecisionInput,
    context?: { userId?: string },
  ): Promise<RefundDecisionOutput> {
    const parsedInput = refundDecisionInputSchema.safeParse(input);
    if (!parsedInput.success) {
      throw new RefundDecisionAdapterError(
        'REFUND_AI_INPUT_INVALID',
        parsedInput.error.flatten().formErrors.join('; ') || 'Invalid refund AI input contract',
      );
    }

    try {
      const result = await this.orchestrator.dispatch<RefundDecisionInput, RefundDecisionOutput>(
        'refund-decision',
        parsedInput.data,
        {
          userId: context?.userId,
        },
      );

      const parsedOutput = refundDecisionOutputSchema.safeParse(result.result);
      if (!parsedOutput.success) {
        throw new RefundDecisionAdapterError(
          'REFUND_AI_OUTPUT_INVALID',
          parsedOutput.error.flatten().formErrors.join('; ') ||
            'Refund AI returned malformed recommendation output',
        );
      }

      return {
        ...parsedOutput.data,
        modelMetadata: {
          ...parsedOutput.data.modelMetadata,
          model: result.model ?? parsedOutput.data.modelMetadata.model,
        },
      };
    } catch (error) {
      if (error instanceof RefundDecisionAdapterError) {
        throw error;
      }

      throw toAdapterError(error);
    }
  }
}

const refundDecisionAdapter = new RefundDecisionAdapterService();

export async function getRefundRecommendation(
  input: RefundDecisionInput,
  context?: { userId?: string },
): Promise<RefundDecisionOutput> {
  return refundDecisionAdapter.getRefundRecommendation(input, context);
}
