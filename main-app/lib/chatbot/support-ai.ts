import { z } from 'zod';

import { AGENT_PROMPTS } from '@/lib/agents/prompts';
import { BUYSMART_SUPPORT_KNOWLEDGE } from '@/lib/chatbot/support-knowledge';
import { buildRefundFallbackReply, isRefundRelatedMessage } from '@/lib/chatbot/refund-fallback';
import type { ChatContext, ChatbotRole, Product } from '@/lib/chatbot/types';
import { isAIConfigured } from '@/lib/services/ai/config';
import { generateChatCompletion } from '@/lib/services/ai/models/llm';

const responseSchema = z.object({
  reply: z.string().min(1).max(280),
  shouldEscalate: z.boolean().optional().default(false),
});

export type SupportAIResult = {
  reply: string;
  shouldEscalate: boolean;
};

export type ProductSearchAIResult = {
  reply: string;
};

function buildSupportSystemPrompt(role: ChatbotRole = 'buyer') {
  const roleDescription =
    role === 'admin'
      ? 'admin-facing support for the BuySmart dashboard and platform operations'
      : role === 'seller'
      ? 'seller-facing support for product listings, inventory, and order management'
      : 'buyer-facing support for product discovery, orders, refunds, and checkout';

  const roleFocus =
    role === 'admin'
      ? 'Use only admin dashboard, platform settings, activity, user management, reporting, and moderation knowledge.'
      : role === 'seller'
      ? 'Use only seller dashboard, product listing, inventory, order management, pricing, and fulfillment knowledge.'
      : 'Use only buyer shopping, product, cart, checkout, orders, refund, and support knowledge.';

  const roleHint =
    role === 'admin'
      ? 'If the question is about seller or buyer actions, answer from the admin point of view and direct the user to the relevant admin feature if applicable.'
      : role === 'seller'
      ? 'If the question is about buyer actions, answer from the seller point of view when possible and mention seller-focused workflows like listings, stock, orders, and payouts.'
      : 'If the question is about admin or seller actions, explain that this chat is for buyers and keep the answer buyer-focused unless asked to switch roles.';

  return `${AGENT_PROMPTS.support}

You are the BuySmart chatbot for ${roleDescription}.

${roleFocus}

Use only the project knowledge below. If the answer is not grounded in that knowledge, say you are not fully sure.

Project knowledge:
${BUYSMART_SUPPORT_KNOWLEDGE}

Return JSON only with this exact shape:
{
  "reply": "short answer",
  "shouldEscalate": false
}

Rules:
- Keep the reply short and helpful.
- Prefer the exact visible UI labels from the project knowledge.
- Do not mention routes, URLs, source files, JSON, APIs, databases, or implementation details unless the user explicitly asks about the technical project.
- For general product, cart, checkout, order, dashboard, listing, or refund questions, answer directly from the provided knowledge.
- ${roleHint}
- If the user asks for a human, live agent, or customer service follow-up, set shouldEscalate to true.
- If unsure, say so briefly instead of inventing steps.`;
}

const PRODUCT_SEARCH_SYSTEM_PROMPT = `${AGENT_PROMPTS.support}

You are the BuySmart chatbot helping a buyer with product discovery.

Use only the supplied search query, parsed filters, and product results.

Return JSON only with this exact shape:
{
  "reply": "short natural reply"
}

Rules:
- Keep the reply short, natural, and specific.
- Sound like a helpful shopping assistant, not a log line.
- Mention the category, budget, or one standout trait when useful.
- Do not invent products or specs not present in the supplied results.
- When mentioning money, always write BDT before the amount, like BDT 2,000.
- Never use the rupee symbol, Tk, taka, or any other currency format.
- Do not mention APIs, code, routes, or implementation details.
- If there are no results, say that briefly and suggest trying a broader search.`;

function extractJsonCandidate(text: string): string {
  const fencedMatch = text.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const braceStart = text.indexOf('{');
  const braceEnd = text.lastIndexOf('}');

  if (braceStart >= 0 && braceEnd > braceStart) {
    return text.slice(braceStart, braceEnd + 1).trim();
  }

  return text.trim();
}

function normalizeReply(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 280);
}

function buildFallbackReply(message: string): SupportAIResult {
  const normalized = message.toLowerCase();

  if (isRefundRelatedMessage(message)) {
    return {
      reply: buildRefundFallbackReply(message),
      shouldEscalate: false,
    };
  }

  if (/\b(cart|checkout)\b/.test(normalized)) {
    return {
      reply: 'Use Add to Cart first, then open Your Cart and tap Checkout.',
      shouldEscalate: false,
    };
  }

  if (/\b(product|browse|search)\b/.test(normalized)) {
    return {
      reply: 'Use Products to browse the catalog and open a product page for details.',
      shouldEscalate: false,
    };
  }

  if (/\b(human|live agent|customer service|real person)\b/.test(normalized)) {
    return {
      reply: 'Support follow-up can be flagged if you want a person to step in.',
      shouldEscalate: true,
    };
  }

  return {
    reply: 'I can help with Products, Cart, Checkout, Orders, Refund status, and Request Refund.',
    shouldEscalate: false,
  };
}

function buildProductSearchFallbackReply(
  message: string,
  products: Product[],
  filters: { category?: string; price_min?: number; price_max?: number; features?: string[] },
): ProductSearchAIResult {
  if (products.length === 0) {
    if (filters.category && filters.price_max) {
      const label = filters.category === 'headphone' ? 'headphones' : `${filters.category}s`;
      return {
        reply: `I couldn't find any ${label} under BDT ${filters.price_max.toLocaleString()}. Try a broader search or a higher budget.`,
      };
    }

    return {
      reply: 'I could not find a close match for that yet. Try a broader search or a higher budget.',
    };
  }

  const parts: string[] = [];

  if (filters.category) {
    const label = filters.category === 'headphone' ? 'headphones' : `${filters.category}s`;
    parts.push(label);
  }

  if (filters.price_min && filters.price_max) {
    parts.push(`between BDT ${filters.price_min.toLocaleString()} and BDT ${filters.price_max.toLocaleString()}`);
  } else if (filters.price_max) {
    parts.push(`under BDT ${filters.price_max.toLocaleString()}`);
  } else if (filters.price_min) {
    parts.push(`above BDT ${filters.price_min.toLocaleString()}`);
  }

  if (filters.features && filters.features.length > 0) {
    parts.push(`with ${filters.features[0]}`);
  }

  if (parts.length > 0) {
    return {
      reply: `I found a few ${parts.join(' ')} options. Here are some good matches.`,
    };
  }

  if (/\b(phone|laptop|tablet|headphone|product|search|find|need)\b/i.test(message)) {
    return {
      reply: 'I found a few options that match what you asked for. Here are some good picks.',
    };
  }

  return {
    reply: 'Here are some matching products for you.',
  };
}

export async function answerSupportQuestion(
  message: string,
  context: ChatContext,
  role: ChatbotRole = 'buyer',
): Promise<SupportAIResult> {
  if (!isAIConfigured()) {
    return buildFallbackReply(message);
  }

  const recentHistory = context.history.slice(-6);
  const historyText =
    recentHistory.length > 0
      ? recentHistory.map((entry) => `${entry.role}: ${entry.content}`).join('\n')
      : 'No recent chat history.';

  try {
    const completion = await generateChatCompletion(
      [
        {
          role: 'system',
          content: buildSupportSystemPrompt(role),
        },
        {
          role: 'user',
          content: `Recent chat history:\n${historyText}\n\nCurrent user question:\n${message}`,
        },
      ],
      {
        temperature: 0.2,
        maxTokens: 180,
        topP: 0.9,
      },
    );

    const parsed = responseSchema.safeParse(JSON.parse(extractJsonCandidate(completion.text)));
    if (parsed.success) {
      return {
        reply: normalizeReply(parsed.data.reply),
        shouldEscalate: parsed.data.shouldEscalate,
      };
    }

    return {
      reply: normalizeReply(completion.text),
      shouldEscalate: /\b(human|live agent|customer service|follow-up)\b/i.test(completion.text),
    };
  } catch {
    return buildFallbackReply(message);
  }
}

export async function answerProductSearchQuestion(
  message: string,
  products: Product[],
  filters: { category?: string; price_min?: number; price_max?: number; features?: string[] },
): Promise<ProductSearchAIResult> {
  if (!isAIConfigured()) {
    return buildProductSearchFallbackReply(message, products, filters);
  }

  try {
    const completion = await generateChatCompletion(
      [
        {
          role: 'system',
          content: PRODUCT_SEARCH_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: JSON.stringify(
            {
              userQuery: message,
              filters,
              results: products.map((product) => ({
                name: product.name,
                price: product.price,
                category: product.category,
                badge: product.badge ?? null,
                features: product.features,
              })),
            },
            null,
            2,
          ),
        },
      ],
      {
        temperature: 0.3,
        maxTokens: 120,
        topP: 0.9,
      },
    );

    const parsed = z
      .object({
        reply: z.string().min(1).max(240),
      })
      .safeParse(JSON.parse(extractJsonCandidate(completion.text)));

    if (parsed.success) {
      return {
        reply: normalizeReply(parsed.data.reply),
      };
    }

    return {
      reply: normalizeReply(completion.text),
    };
  } catch {
    return buildProductSearchFallbackReply(message, products, filters);
  }
}
