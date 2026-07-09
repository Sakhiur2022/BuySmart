import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type {
  AIParams,
  AIResponse,
  ChatAPIResponse,
  ChatContext,
  Order,
  Product,
} from '@/lib/chatbot/types';
import type { RecommendationAdapterContext } from '@/lib/chatbot/buyer-intent/adapter';
import { BuyerChatToolsFacade } from '@/lib/chatbot/buyer-intent/facade';
import { getIntentValidationEventEmitter } from '@/lib/chatbot/buyer-intent/events';
import { invokeBuyerToolCall } from '@/lib/chatbot/buyer-intent/tool-invocation';
// Minimal local facade type to avoid importing the seller facade type directly.
type FacadeResult<T> =
  | { success: true; value: T }
  | { success: false; error: { code: string; message: string } };

import { invokeSellerToolCall } from '@/lib/chatbot/seller-intent/tool-invocation';
import type { SellerToolCall as SellerInvocationToolCall } from '@/lib/chatbot/seller-intent/tool-invocation';
import type {
  SalesSummaryToolInput,
  ListingCreateToolInput,
} from '@/lib/chatbot/seller-intent/tool-contracts';
import type { SellerToolCall as SellerFacadeToolCall } from '@/lib/chatbot/seller-intent/facade';
import type { SellerIntent } from '@/lib/chatbot/seller-intent/schemas';

type SellerFacadeType = {
  resolveIntent: (raw: unknown) => FacadeResult<SellerIntent>;
  buildToolCall: (intent: SellerIntent, context?: unknown) => FacadeResult<SellerFacadeToolCall>;
};
import { recommendationCandidateSchema } from '@/lib/chatbot/buyer-intent/tool-contracts';
import { answerProductSearchQuestion, answerSupportQuestion } from '@/lib/chatbot/support-ai';

export const SAMPLE_PRODUCTS: Product[] = [
  {
    id: 'p1',
    name: 'Redmi Note 13 Pro',
    price: 18999,
    category: 'phone',
    images: [],
    stock_available: true,
    features: ['gaming', 'battery', 'camera'],
    badge: 'Best battery',
    emoji: 'phone',
  },
  {
    id: 'p2',
    name: 'Realme Narzo 60',
    price: 17500,
    category: 'phone',
    images: [],
    stock_available: true,
    features: ['gaming', 'fast-charge'],
    badge: 'Gaming pick',
    emoji: 'phone',
  },
  {
    id: 'p3',
    name: 'HP Victus 15',
    price: 58000,
    category: 'laptop',
    images: [],
    stock_available: true,
    features: ['gaming', 'gpu'],
    badge: 'GTX 1650',
    emoji: 'laptop',
  },
  {
    id: 'p4',
    name: 'Sony WH-1000XM5',
    price: 35000,
    category: 'headphone',
    images: [],
    stock_available: true,
    features: ['noise-cancel', 'battery'],
    badge: 'ANC',
    emoji: 'headphone',
  },
];

export const SAMPLE_ORDER: Order = {
  id: 'ORD-4821',
  status: 'shipped',
  created_at: '2026-04-24T10:30:00Z',
  buyer_id: 'user_demo',
  items: [{ id: 'i1', name: 'Samsung Galaxy M34 5G', quantity: 1, price: 20000 }],
};

export const SAMPLE_REFUND_POLICY = `You can request a refund within 7 days of delivery for any defective or wrong item.
Tap Orders, open View details for the order, and use Request Refund.
After submission, check the latest refund progress in Refund status and tap Details.
Approved refunds are typically processed within 3-5 business days to the original payment method.`;

export function searchSampleProducts(params: AIParams): Product[] {
  let results = SAMPLE_PRODUCTS;

  if (params.category) {
    results = results.filter((product) =>
      product.category.toLowerCase().includes(params.category!.toLowerCase()),
    );
  }

  if (params.price_max) {
    results = results.filter((product) => product.price <= params.price_max!);
  }

  if (params.price_min) {
    results = results.filter((product) => product.price >= params.price_min!);
  }

  if (params.features && params.features.length > 0) {
    results = results.filter((product) =>
      params.features!.some((feature) => product.features.includes(feature)),
    );
  }

  return results.slice(0, 4);
}

export function getSampleOrder(_orderId: string): Order {
  return SAMPLE_ORDER;
}

function createRequestId(role: 'buyer' | 'seller' | 'admin') {
  return `${role}-chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function logChatError(
  stage: string,
  requestId: string,
  details: Record<string, unknown>,
  error?: unknown,
) {
  console.error('[chat-api] request failed', {
    requestId,
    stage,
    ...details,
    errorMessage: error ? getErrorMessage(error) : undefined,
    error,
  });
}

const requestSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  role: z.enum(['buyer', 'seller', 'admin']).optional(),
  context: z
    .object({
      category: z.string().nullable(),
      price_max: z.number().nullable(),
      lastOrderId: z.string().nullable(),
      history: z
        .array(
          z.object({
            role: z.enum(['user', 'assistant']),
            content: z.string().trim().min(1).max(2000),
          }),
        )
        .optional(),
    })
    .optional(),
  intentOutput: z.unknown().optional(),
  recommendationContext: z
    .object({
      candidates: z.array(recommendationCandidateSchema).min(1),
      contextSummary: z.string().max(500).optional(),
      maxResults: z.number().int().min(1).max(10).optional(),
    })
    .optional(),
});

const buyerIntentFacade = new BuyerChatToolsFacade({
  eventEmitter: getIntentValidationEventEmitter(),
});

const CATEGORY_ALIAS: Record<string, string> = {
  phone: 'phone',
  phones: 'phone',
  smartphone: 'phone',
  smartphones: 'phone',
  mobile: 'phone',
  mobilephone: 'phone',
  'mobile phone': 'phone',
  laptop: 'laptop',
  laptops: 'laptop',
  notebook: 'laptop',
  notebooks: 'laptop',
  tablet: 'tablet',
  tablets: 'tablet',
  tab: 'tablet',
  headphone: 'headphone',
  headphones: 'headphone',
  headset: 'headphone',
  headsets: 'headphone',
};

const FEATURE_ALIAS: Record<string, string[]> = {
  gaming: ['gaming', 'game', 'games'],
  battery: ['battery', 'battery life', 'long battery', 'fast charge', 'fast-charge'],
  camera: ['camera', 'photography', 'selfie', 'photo'],
  display: ['display', 'screen', 'resolution'],
  'noise-cancel': ['noise cancel', 'noise-cancel', 'noise cancelling', 'noise cancellation', 'anc'],
  performance: ['performance', 'fast', 'powerful', 'speed'],
};

function normalizeText(message: string) {
  return message
    .toLowerCase()
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

function parseCategory(message: string) {
  const normalized = normalizeText(message);

  for (const [alias, category] of Object.entries(CATEGORY_ALIAS)) {
    if (new RegExp(`\\b${escapeRegExp(alias)}\\b`).test(normalized)) {
      return category;
    }
  }

  return undefined;
}

function parseFeatures(message: string) {
  const normalized = normalizeText(message);
  const features = new Set<string>();

  for (const [feature, aliases] of Object.entries(FEATURE_ALIAS)) {
    for (const alias of aliases) {
      if (new RegExp(`\\b${escapeRegExp(alias)}\\b`).test(normalized)) {
        features.add(feature);
        break;
      }
    }
  }

  return [...features];
}

function parsePriceValues(message: string) {
  const normalized = normalizeText(message).replace(/,/g, '');
  const params: { price_min?: number; price_max?: number } = {};

  const betweenMatch = normalized.match(
    /(?:between|from)\s*(\d{1,7})\s*(?:taka|tk|bdt)?\s*(?:and|to)\s*(\d{1,7})/,
  );
  if (betweenMatch) {
    params.price_min = Number(betweenMatch[1]);
    params.price_max = Number(betweenMatch[2]);
    if (params.price_min && params.price_max && params.price_min > params.price_max) {
      [params.price_min, params.price_max] = [params.price_max, params.price_min];
    }
  }

  const lessThanMatch = normalized.match(
    /(?:under|below|less than|up to|maximum|max)\s*(\d{1,7})\s*(?:taka|tk|bdt)?/,
  );
  if (lessThanMatch) {
    params.price_max = Number(lessThanMatch[1]);
  }

  const greaterThanMatch = normalized.match(
    /(?:above|over|more than|minimum|min)\s*(\d{1,7})\s*(?:taka|tk|bdt)?/,
  );
  if (greaterThanMatch) {
    params.price_min = Number(greaterThanMatch[1]);
  }

  if (!params.price_min && !params.price_max) {
    const explicitMatch = normalized.match(/(\d{3,7})\s*(?:taka|tk|bdt)/);
    if (explicitMatch) {
      params.price_max = Number(explicitMatch[1]);
    }
  }

  return params;
}

function parseOrderId(message: string) {
  const match = message.match(/\bORD[-_]?\d+\b/i);
  return match ? match[0].toUpperCase().replace('_', '-') : undefined;
}

function composeTrackOrderReply(params: AIParams) {
  const query = params.query ?? '';
  const isOrderStatusQuestion = /\b(status|progress|update|track|check|find|where)\b/.test(query);

  if (params.orderId) {
    if (isOrderStatusQuestion) {
      return `Tap Orders, then View details for order ${params.orderId}.`;
    }

    return `Tap Orders, then open order ${params.orderId}.`;
  }

  return 'Tap Orders, then View details on the order.';
}

function composeRefundReply(params: AIParams) {
  const query = params.query ?? '';
  const isRefundStatusQuestion = /\b(status|progress|update|track|check)\b/.test(query);
  const isRefundRequestQuestion = /\b(request|apply|start|submit|make|get)\b/.test(query);

  if (params.orderId) {
    if (isRefundStatusQuestion) {
      return `Open Refund status and tap Details for the latest update.`;
    }

    return `Tap Orders, open View details for order ${params.orderId}, then use Request Refund.`;
  }

  if (isRefundStatusQuestion) {
    return 'Check Refund status and tap Details.';
  }

  if (isRefundRequestQuestion) {
    return 'Tap Orders, then View details, then Request Refund.';
  }

  return 'Tap Orders, then View details, then Request Refund. For refund status, check Refund status and tap Details.';
}

function shouldShowRefundPolicy(query?: string) {
  if (!query) {
    return false;
  }

  return /\b(policy|eligible|eligibility|window|days|return window)\b/.test(query);
}

function wantsHumanSupport(query?: string) {
  if (!query) {
    return false;
  }

  return /\b(human|live agent|customer service|real person|representative)\b/.test(query);
}

function composeReply(intent: string, params: AIParams): string {
  switch (intent) {
    case 'PRODUCT_SEARCH': {
      const parts: string[] = [];
      if (params.category) {
        parts.push(`category: ${params.category}`);
      }
      if (params.features && params.features.length > 0) {
        parts.push(`features: ${params.features.join(', ')}`);
      }
      if (params.price_min || params.price_max) {
        const priceRange =
          params.price_min && params.price_max
            ? `${params.price_min}–${params.price_max} taka`
            : params.price_max
              ? `under ${params.price_max} taka`
              : `above ${params.price_min} taka`;
        parts.push(priceRange);
      }

      if (parts.length === 0) {
        return 'Tell me what kind of product you are looking for, for example a gaming phone under 20k or a laptop with long battery life.';
      }

      return `Searching for ${parts.join(', ')}.`;
    }

    case 'TRACK_ORDER':
      return composeTrackOrderReply(params);

    case 'REFUND_POLICY':
      return composeRefundReply(params);

    case 'FAQ':
      return 'Let me check that for you.';

    case 'SUPPORT':
      return 'Support follow-up can be flagged if you want a person to step in.';

    default:
      return 'I am not sure what you need yet. Please tell me if you want to search products, track an order, ask about refunds, or contact support.';
  }
}

function detectIntent(userMessage: string, context: ChatContext): AIResponse {
  const normalized = normalizeText(userMessage);
  const params: AIParams = {
    category: parseCategory(normalized),
    features: parseFeatures(normalized),
    ...parsePriceValues(normalized),
    orderId: parseOrderId(userMessage),
    query: normalized,
  };

  const hasOrderPhrases =
    /\b(track|where.*order|order status|find my order|order update|shipment|delivered)\b/.test(
      normalized,
    );
  const hasRefundPhrases =
    /\b(refund|return|refund policy|cancel order|wrong item|defective|exchange)\b/.test(normalized);
  const hasSupportPhrases =
    /\b(help|support|human|agent|customer service|complaint|issue|problem)\b/.test(normalized);
  const hasHumanSupportPhrases = wantsHumanSupport(normalized);
  const hasProductPhrases =
    /\b(show|find|search|looking for|need|recommend|suggest|available|buy|price|budget)\b/.test(
      normalized,
    );

  let intent: AIResponse['intent'] = 'FAQ';

  if (params.orderId && !hasRefundPhrases && !hasSupportPhrases) {
    intent = 'TRACK_ORDER';
  } else if (hasOrderPhrases) {
    intent = 'TRACK_ORDER';
  } else if (hasRefundPhrases) {
    intent = 'REFUND_POLICY';
  } else if (hasHumanSupportPhrases) {
    intent = 'SUPPORT';
  } else if (
    params.category ||
    params.price_max ||
    params.price_min ||
    (params.features?.length ?? 0) ||
    hasProductPhrases
  ) {
    intent = 'PRODUCT_SEARCH';
  }

  const mergedParams: AIParams = {
    ...params,
    category: params.category ?? context.category ?? undefined,
    price_max: params.price_max ?? context.price_max ?? undefined,
  };

  if (!mergedParams.features) {
    mergedParams.features = [];
  }

  return {
    intent,
    params: mergedParams,
    reply: composeReply(intent, mergedParams),
  };
}

async function routeIntent(
  aiResponse: AIResponse,
  context: ChatContext,
  userMessage: string,
  role: 'buyer' | 'seller' | 'admin',
): Promise<Partial<ChatAPIResponse>> {
  switch (aiResponse.intent) {
    case 'PRODUCT_SEARCH': {
      const products = searchSampleProducts(aiResponse.params);
      const searchReply = await answerProductSearchQuestion(userMessage, products, {
        category: aiResponse.params.category,
        price_min: aiResponse.params.price_min,
        price_max: aiResponse.params.price_max,
        features: aiResponse.params.features,
      });
      return {
        reply: searchReply.reply,
        products,
      };
    }

    case 'TRACK_ORDER': {
      const orderId = aiResponse.params.orderId ?? context.lastOrderId ?? 'ORD-4821';
      const order = getSampleOrder(orderId);
      return {
        reply: aiResponse.reply,
        order,
      };
    }

    case 'REFUND_POLICY': {
      return {
        reply: aiResponse.reply,
        policyText: shouldShowRefundPolicy(aiResponse.params.query)
          ? SAMPLE_REFUND_POLICY
          : undefined,
      };
    }

    case 'SUPPORT': {
      const supportResult = await answerSupportQuestion(userMessage, context, role);
      return {
        reply: supportResult.reply,
        isEscalation: supportResult.shouldEscalate || wantsHumanSupport(aiResponse.params.query),
      };
    }

    case 'FAQ':
    default:
      const supportResult = await answerSupportQuestion(userMessage, context, role);
      return {
        reply: supportResult.reply,
      };
  }
}

export async function handleRoleChatRequest(
  request: NextRequest,
  role: 'buyer' | 'seller' | 'admin',
  roleFacade?: SellerFacadeType,
) {
  const requestId = createRequestId(role);
  let parsedBody;
  let payload: unknown;

  try {
    payload = await request.json();
    parsedBody = requestSchema.safeParse(payload);
  } catch (error) {
    logChatError(
      'parse-json',
      requestId,
      {
        method: request.method,
        path: request.nextUrl.pathname,
      },
      error,
    );

    return NextResponse.json({ error: 'Invalid JSON payload.', requestId }, { status: 400 });
  }

  if (!parsedBody.success) {
    logChatError('validate-request', requestId, {
      method: request.method,
      path: request.nextUrl.pathname,
      issues: parsedBody.error.flatten(),
      payload,
    });

    return NextResponse.json(
      {
        error: 'Validation failed.',
        issues: parsedBody.error.flatten(),
        requestId,
      },
      { status: 400 },
    );
  }

  try {
    const {
      message,
      context: requestContext,
      intentOutput,
      recommendationContext,
    } = parsedBody.data;
    const context: ChatContext = {
      category: requestContext?.category ?? null,
      price_max: requestContext?.price_max ?? null,
      lastOrderId: requestContext?.lastOrderId ?? null,
      history: requestContext?.history ?? [],
    };

    let intentResolution: ChatAPIResponse['intentResolution'] | undefined;
    let toolCall: ChatAPIResponse['toolCall'] | undefined;
    let toolError: ChatAPIResponse['toolError'] | undefined;
    let toolResult: ChatAPIResponse['toolResult'] | undefined;
    let refundReferenceId: ChatAPIResponse['refundReferenceId'] | undefined;

    if (intentOutput !== undefined) {
      if (role === 'buyer') {
        const resolvedIntent = buyerIntentFacade.resolveIntent(intentOutput);

        if (resolvedIntent.success) {
          intentResolution = { success: true, intent: resolvedIntent.value };

          const adapterContext: RecommendationAdapterContext | undefined = recommendationContext
            ? {
                candidates: recommendationContext.candidates,
                contextSummary: recommendationContext.contextSummary,
                maxResults: recommendationContext.maxResults,
              }
            : undefined;

          const toolCallResult = buyerIntentFacade.buildToolCall(
            resolvedIntent.value,
            adapterContext,
          );
          if (toolCallResult.success) {
            toolCall = toolCallResult.value;
            const invoked = await invokeBuyerToolCall(toolCallResult.value);
            if (invoked.success) {
              toolResult = invoked.value.output;

              if (
                invoked.value.toolName === 'refund_request' &&
                typeof invoked.value.output === 'object' &&
                invoked.value.output &&
                'refund' in invoked.value.output
              ) {
                const refundOutput = invoked.value.output as {
                  refund?: { refund_number?: string };
                };
                refundReferenceId = refundOutput.refund?.refund_number;
              }
            } else {
              toolError = invoked.error;
            }
          } else {
            toolError = toolCallResult.error;
          }
        } else {
          intentResolution = { success: false, error: resolvedIntent.error };
        }
      }

      if (role === 'seller' && roleFacade) {
        const resolvedIntent = roleFacade.resolveIntent(intentOutput);
        if (resolvedIntent.success) {
          intentResolution = { success: true, intent: resolvedIntent.value };
          const toolCallResult = roleFacade.buildToolCall(resolvedIntent.value);
          if (toolCallResult.success) {
            toolCall = toolCallResult.value as unknown as SellerFacadeToolCall;
            try {
              const metadata = (intentOutput as Record<string, unknown>)?.metadata as
                | Record<string, unknown>
                | undefined;
              const sellerId = typeof metadata?.sellerId === 'string' ? metadata.sellerId : '';

              const facadeCall = toolCallResult.value as SellerFacadeToolCall;
              if (facadeCall.toolName === 'seller_sales_summary') {
                const invocationCall: SellerInvocationToolCall = {
                  toolName: 'seller_sales_summary',
                  input: facadeCall.input as SalesSummaryToolInput,
                };

                const invoked = await invokeSellerToolCall(invocationCall, sellerId);
                toolResult = invoked;
              } else if (facadeCall.toolName === 'seller_listing_create') {
                const invocationCall: SellerInvocationToolCall = {
                  toolName: 'seller_listing_create',
                  input: facadeCall.input as ListingCreateToolInput,
                };

                const invoked = await invokeSellerToolCall(invocationCall, sellerId);
                toolResult = invoked;
              } else {
                toolError = {
                  code: 'TOOL_INVOCATION_ERROR',
                  message: 'Unknown seller tool',
                } as ChatAPIResponse['toolError'];
              }
            } catch (err: unknown) {
              const errMsg = err instanceof Error ? err.message : String(err);
              toolError = {
                code: 'TOOL_INVOCATION_ERROR',
                message: errMsg,
              } as ChatAPIResponse['toolError'];
            }
          } else {
            toolError = toolCallResult.error as ChatAPIResponse['toolError'];
          }
        } else {
          intentResolution = { success: false, error: resolvedIntent.error };
        }
      }
    }

    const aiResponse = detectIntent(message, context);
    const result = await routeIntent(aiResponse, context, message, role);
    const finalReply = result.reply ?? aiResponse.reply;

    const updatedContext: ChatContext = {
      ...context,
      category: aiResponse.params.category ?? context.category,
      price_max: aiResponse.params.price_max ?? context.price_max,
      lastOrderId: aiResponse.params.orderId ?? context.lastOrderId,
      history: [
        ...context.history,
        { role: 'user' as const, content: message },
        { role: 'assistant' as const, content: finalReply },
      ].slice(-20),
    };

    const responsePayload: ChatAPIResponse = {
      intent: aiResponse.intent,
      reply: finalReply,
      updatedContext,
      ...result,
      intentResolution,
      toolCall,
      toolError,
      toolResult,
      refundReferenceId,
    };

    console.info('[chat-api] request succeeded', {
      requestId,
      method: request.method,
      path: request.nextUrl.pathname,
      intent: aiResponse.intent,
      intentResolution: intentResolution?.success ? intentResolution.intent?.intent : undefined,
      toolCall: toolCall?.toolName,
      messagePreview: message.slice(0, 120),
    });

    return NextResponse.json(responsePayload);
  } catch (error) {
    const requestBody = parsedBody.data;

    logChatError(
      'handle-request',
      requestId,
      {
        method: request.method,
        path: request.nextUrl.pathname,
        messagePreview: requestBody.message.slice(0, 120),
        context: requestBody.context ?? null,
      },
      error,
    );

    return NextResponse.json(
      {
        error: 'Failed to process chat request.',
        requestId,
      },
      { status: 500 },
    );
  }
}

