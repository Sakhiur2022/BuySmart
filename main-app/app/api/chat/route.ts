import { NextRequest, NextResponse } from 'next/server';
import type {
  AIParams,
  AIResponse,
  ChatAPIRequest,
  ChatAPIResponse,
  ChatContext,
} from '@/lib/chatbot/types';
import {
  mockGetOrder,
  mockSearchProducts,
  MOCK_POLICY,
} from '@/lib/chatbot/mockData';

const KNOWN_CATEGORIES = ['phone', 'laptop', 'tablet', 'headphone'];
const KNOWN_FEATURES = [
  'gaming',
  'battery',
  'camera',
  'display',
  'noise-cancel',
  'fast-charge',
  'performance',
];

function parsePriceValues(message: string) {
  const priceRegex = /(?:under|below|less than|maximum|max|up to)\s*(\d{1,6})|(?:above|over|more than|minimum|min)\s*(\d{1,6})|(?:(\d{1,6})\s*(?:taka|tk|bdt))/gi;
  const params: { price_min?: number; price_max?: number } = {};

  let match;
  while ((match = priceRegex.exec(message)) !== null) {
    const [, upper, lower, explicit] = match;

    if (upper) {
      params.price_max = Number(upper);
    }

    if (lower) {
      params.price_min = Number(lower);
    }

    if (explicit) {
      const value = Number(explicit);
      if (!params.price_max) {
        params.price_max = value;
      }
    }
  }

  return params;
}

function parseCategory(message: string) {
  const normalized = message.toLowerCase();
  return KNOWN_CATEGORIES.find((category) => normalized.includes(category)) ?? null;
}

function parseFeatures(message: string) {
  const normalized = message.toLowerCase();
  return KNOWN_FEATURES.filter((feature) => normalized.includes(feature));
}

function parseOrderId(message: string) {
  const match = message.match(/ORD[-_]?[0-9]+/i);
  return match ? match[0].toUpperCase().replace('_', '-') : null;
}

function composeReply(intent: string, params: AIParams): string {
  switch (intent) {
    case 'PRODUCT_SEARCH':
      return `Here are some options based on your request${params.category ? ` for ${params.category}` : ''}${params.price_max ? ` under ${params.price_max} taka` : ''}.`;
    case 'TRACK_ORDER':
      return params.orderId
        ? `I found your order ${params.orderId}. Let me show the latest status.`
        : 'Please provide your order ID so I can track it for you.';
    case 'REFUND_POLICY':
      return 'Here is our refund policy and how you can request a refund.';
    case 'FAQ':
      return 'I can answer common questions about products, orders, refunds, and support.';
    case 'SUPPORT':
      return 'I am escalating this to our human support team. Someone will reach out soon.';
    default:
      return 'I am not sure how to help with that yet, but I can search products, track orders, explain refunds, or escalate support.';
  }
}

function detectIntent(userMessage: string, context: ChatContext): AIResponse {
  const normalized = userMessage.toLowerCase();
  const params: AIParams = {
    category: parseCategory(normalized),
    features: parseFeatures(normalized),
    ...parsePriceValues(normalized),
    orderId: parseOrderId(userMessage),
    query: normalized,
  };

  let intent: AIResponse['intent'] = 'FAQ';

  if (/\b(track|where.*order|order status|find my order)\b/.test(normalized)) {
    intent = 'TRACK_ORDER';
  } else if (/\b(refund|return|refund policy|cancel order)\b/.test(normalized)) {
    intent = 'REFUND_POLICY';
  } else if (/\b(help|support|human|agent|customer service)\b/.test(normalized)) {
    intent = 'SUPPORT';
  } else if (params.category || params.price_max || params.price_min || params.features?.length) {
    intent = 'PRODUCT_SEARCH';
  }

  if (intent === 'PRODUCT_SEARCH' && !params.features?.length) {
    params.features = [];
  }

  return {
    intent,
    params,
    reply: composeReply(intent, params),
  };
}

async function routeIntent(
  aiResponse: AIResponse,
  context: ChatContext,
): Promise<Partial<ChatAPIResponse>> {
  switch (aiResponse.intent) {
    case 'PRODUCT_SEARCH': {
      const products = mockSearchProducts(aiResponse.params);
      return { reply: aiResponse.reply, products };
    }
    case 'TRACK_ORDER': {
      const orderId = aiResponse.params.orderId ?? context.lastOrderId ?? 'ORD-4821';
      const order = mockGetOrder(orderId);
      return { reply: aiResponse.reply, order };
    }
    case 'REFUND_POLICY': {
      return { reply: aiResponse.reply, policyText: MOCK_POLICY };
    }
    case 'FAQ': {
      return { reply: aiResponse.reply };
    }
    case 'SUPPORT': {
      return { reply: aiResponse.reply, isEscalation: true };
    }
    default:
      return { reply: aiResponse.reply };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatAPIRequest;
    const context: ChatContext = {
      category: body.context?.category ?? null,
      price_max: body.context?.price_max ?? null,
      lastOrderId: body.context?.lastOrderId ?? null,
      history: Array.isArray(body.context?.history) ? body.context.history : [],
    };

    const aiResponse = detectIntent(body.message, context);
    const result = await routeIntent(aiResponse, context);

    const updatedContext: ChatContext = {
      ...context,
      category: aiResponse.params.category ?? context.category,
      price_max: aiResponse.params.price_max ?? context.price_max,
      lastOrderId: aiResponse.params.orderId ?? context.lastOrderId,
      history: [
        ...context.history,
        { role: 'user', content: body.message },
        { role: 'assistant', content: aiResponse.reply },
      ].slice(-20),
    };

    const responsePayload: ChatAPIResponse = {
      intent: aiResponse.intent,
      reply: aiResponse.reply,
      updatedContext,
      ...result,
    };

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error('/api/chat error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
