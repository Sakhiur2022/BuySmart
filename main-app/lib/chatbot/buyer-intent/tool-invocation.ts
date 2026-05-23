import { AgentOrchestrator } from '@/lib/agents/orchestrator';
import { RecommendationAgent } from '@/lib/agents/recommendation/recommendation-agent';
import type {
  RecommendationPayload,
  RecommendationResult,
} from '@/lib/agents/recommendation/types';
import { requireAuthenticatedUser } from '@/app/api/cart/_shared';
import { createRefund } from '@/lib/controllers/refund.controller';
import type { BuyerIntentError, BuyerIntentResult } from '@/lib/chatbot/buyer-intent/errors';
import { withToolValidation } from '@/lib/chatbot/buyer-intent/decorators';
import type { BuyerToolCall } from '@/lib/chatbot/buyer-intent/facade';
import { BuyerIntentToolFactory } from '@/lib/chatbot/buyer-intent/tool-factory';
import type { ToolContract } from '@/lib/chatbot/buyer-intent/tool-contracts';
import type { ChatContext } from '@/lib/chatbot/types';
import { answerSupportQuestion } from '@/lib/chatbot/support-ai';

export type BuyerToolInvocationResult = BuyerIntentResult<{
  toolName: string;
  output: unknown;
}>;

const DEFAULT_CHAT_CONTEXT: ChatContext = {
  category: null,
  price_max: null,
  lastOrderId: null,
  history: [],
};

const recommendationOrchestrator = new AgentOrchestrator();
recommendationOrchestrator.register(new RecommendationAgent());

function buildError(message: string, details?: Record<string, unknown>): BuyerIntentError {
  return {
    code: 'ADAPTER_ERROR',
    message,
    details,
  };
}

async function runRefundRequestTool(input: unknown) {
  const { userId } = await requireAuthenticatedUser();
  const refund = await createRefund(userId, input as Parameters<typeof createRefund>[1]);

  return {
    refund: {
      refund_id: refund.refund_id,
      refund_number: refund.refund_number,
      order_id: refund.order_id,
      status: refund.status,
      requested_amount: refund.requested_amount,
      created_at: refund.created_at,
    },
  };
}

async function runRecommendationTool(input: unknown) {
  const result = await recommendationOrchestrator.dispatch<
    RecommendationPayload,
    RecommendationResult
  >('recommendation', input as RecommendationPayload);

  if (!result.success) {
    throw new Error(result.errorMessage ?? 'Recommendation tool failed.');
  }

  return result.result;
}

async function runPolicyQaTool(input: unknown) {
  const payload = input as { question: string; domain: string };
  const response = await answerSupportQuestion(payload.question, DEFAULT_CHAT_CONTEXT);

  return {
    answer: response.reply,
    domain: payload.domain,
    citations: [],
    confidence: undefined,
  };
}

async function executeValidatedTool(
  contract: ToolContract<unknown, unknown>,
  toolName: string,
  input: unknown,
): Promise<BuyerToolInvocationResult> {
  let executor: (payload: unknown) => Promise<unknown>;

  switch (toolName) {
    case 'refund_request':
      executor = runRefundRequestTool;
      break;
    case 'product_recommendation':
      executor = runRecommendationTool;
      break;
    case 'policy_qa':
      executor = runPolicyQaTool;
      break;
    default:
      return {
        success: false,
        error: {
          code: 'TOOL_NOT_FOUND',
          message: `No executor registered for tool: ${toolName}`,
        },
      };
  }

  const validatedExecutor = withToolValidation(contract, executor);

  try {
    const result = await validatedExecutor(input);
    if (!result.success) {
      return result;
    }

    return {
      success: true,
      value: {
        toolName,
        output: result.value,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: buildError(error instanceof Error ? error.message : 'Tool execution failed.'),
    };
  }
}

export async function invokeBuyerToolCall(
  toolCall: BuyerToolCall,
): Promise<BuyerToolInvocationResult> {
  const toolFactory = new BuyerIntentToolFactory();
  const contractResult = toolFactory.getTool(toolCall.intent.intent);

  if (!contractResult.success) {
    return contractResult;
  }

  return executeValidatedTool(contractResult.value, toolCall.toolName, toolCall.input);
}
