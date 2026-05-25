import { AgentOrchestrator } from '@/lib/agents/orchestrator';
import { RecommendationAgent } from '@/lib/agents/recommendation/recommendation-agent';
import type {
  RecommendationPayload,
  RecommendationResult,
} from '@/lib/agents/recommendation/types';
import { requireAuthenticatedUser } from '@/app/api/cart/_shared';
import type { BuyerIntentError, BuyerIntentResult } from '@/lib/chatbot/buyer-intent/errors';
import { withToolValidation } from '@/lib/chatbot/buyer-intent/decorators';
import type { BuyerToolCall } from '@/lib/chatbot/buyer-intent/facade';
import { BuyerIntentToolFactory } from '@/lib/chatbot/buyer-intent/tool-factory';
import type { ToolContract } from '@/lib/chatbot/buyer-intent/tool-contracts';
import type { ChatContext } from '@/lib/chatbot/types';
import { answerSupportQuestion } from '@/lib/chatbot/support-ai';
import {
  BuyerRefundToolFacade,
  getRefundToolEventEmitter,
  isRetriableRefundToolError,
  mapRefundToolError,
  withRetry,
} from '@/lib/services/refund-tools';

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

const refundToolFacade = new BuyerRefundToolFacade();

async function runRefundRequestTool(input: unknown) {
  const { userId } = await requireAuthenticatedUser();
  const executor = withRetry(
    (payload) => refundToolFacade.submitRefund({ buyerId: userId, payload }),
    isRetriableRefundToolError,
  );

  return executor(input as Parameters<typeof refundToolFacade.submitRefund>[0]['payload']);
}

async function runRefundOrdersFetchTool(input: unknown) {
  const { userId } = await requireAuthenticatedUser();
  const payload = input as { orderSignal?: { orderId?: string; recentOrders?: boolean } };
  return refundToolFacade.fetchOrders({ buyerId: userId, orderSignal: payload.orderSignal });
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
    case 'refund_orders_fetch':
      executor = runRefundOrdersFetchTool;
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
    if (toolName === 'refund_request' || toolName === 'refund_orders_fetch') {
      const mapped = mapRefundToolError(error);
      const details = mapped.details as
        | { retriable: boolean; mascotTrigger: boolean; kind: string }
        | undefined;
      const normalizedDetails = {
        kind:
          details?.kind === 'business' || details?.kind === 'validation'
            ? details.kind
            : details?.kind === 'infrastructure'
              ? details.kind
              : 'unknown',
        retriable: Boolean(details?.retriable),
        mascotTrigger: Boolean(details?.mascotTrigger),
      };
      try {
        const { userId } = await requireAuthenticatedUser();
        const orderId =
          typeof input === 'object' && input && 'order_id' in input
            ? String((input as { order_id?: string }).order_id ?? '') || undefined
            : undefined;

        if (toolName === 'refund_orders_fetch') {
          getRefundToolEventEmitter().emit({
            type: 'orders_fetch_failed',
            buyerId: userId,
            error: {
              code: mapped.code,
              message: mapped.message,
              details: normalizedDetails,
            },
            timestamp: Date.now(),
          });
        } else {
          getRefundToolEventEmitter().emit({
            type: 'refund_failed',
            buyerId: userId,
            orderId,
            error: {
              code: mapped.code,
              message: mapped.message,
              details: normalizedDetails,
            },
            timestamp: Date.now(),
          });
        }
      } catch {
        // No-op: event emission should not block tool errors.
      }

      return {
        success: false,
        error: mapped,
      };
    }

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
  const contractResult = toolFactory.getToolByName(toolCall.toolName);

  if (!contractResult.success) {
    return contractResult;
  }

  return executeValidatedTool(contractResult.value, toolCall.toolName, toolCall.input);
}
