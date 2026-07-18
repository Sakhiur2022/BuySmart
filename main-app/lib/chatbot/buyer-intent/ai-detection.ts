import { z } from 'zod';
import { AGENT_PROMPTS } from '@/lib/agents/prompts';
import { isAIConfigured } from '@/lib/services/ai/config';
import { generateChatCompletion } from '@/lib/services/ai/models/llm';
import type { BuyerIntent } from '@/lib/chatbot/buyer-intent/types';
import { buyerIntentSchema } from '@/lib/chatbot/buyer-intent/schemas';

const BUYER_INTENT_DETECTION_SYSTEM_PROMPT = `${AGENT_PROMPTS.support}

You are an AI intent detection system for the BuySmart e-commerce platform. Your job is to analyze user messages and determine their buyer intent.

Analyze the user's message and determine which of the following intents they have:
1. REFUND_REQUEST - User wants to request a refund for an order or item
2. PRODUCT_RECOMMENDATION - User is looking for product recommendations 
3. POLICY_QA - User is asking about policies (returns, shipping, payments, account)

Return JSON only with this exact shape:
{
  "intent": "REFUND_REQUEST" | "PRODUCT_RECOMMENDATION" | "POLICY_QA",
  "payload": { /* intent-specific payload */ },
  "metadata": {
    "confidenceScore": 0.95,
    "isPartial": false,
    "source": "ai_detection"
  }
}

For REFUND_REQUEST payload:
{
  "orderSignal": {
    "orderId": "string (optional)",
    "recentOrders": true/false (optional),
    "orderDescription": "string (optional)"
  },
  "reason": "damage" | "non_delivery" | "wrong_item" | "other" (optional),
  "reasonDescription": "string (optional)",
  "evidence": "photo_attached" | "no_photo" | "unknown" (optional),
  "evidenceImages": ["url1", "url2"] (optional),
  "requestedAmount": number (optional),
  "currency": "BDT" (optional),
  "items": [{
    "productId": "uuid",
    "orderItemId": "uuid (optional)",
    "quantity": number,
    "unitAmount": number,
    "totalAmount": number (optional)
  }] (optional),
  "buyerId": "uuid (optional)"
}

For PRODUCT_RECOMMENDATION payload:
{
  "budget": {
    "min": number (optional),
    "max": number (optional),
    "currency": "BDT" (optional)
  },
  "category": "string (optional)",
  "occasion": "string (optional)",
  "recipient": "self" | "gift" | "unknown" (optional),
  "attributes": ["feature1", "feature2"] (optional)
}

For POLICY_QA payload:
{
  "question": "string",
  "domain": "returns" | "shipping" | "payments" | "account" | "other",
  "confidence": "certain" | "ambiguous"
}

Rules:
- Analyze the message carefully to determine the primary intent
- Extract relevant information for the payload based on the intent type
- If the message is unclear or ambiguous, set isPartial to true in metadata
- Set confidenceScore based on how clear the intent is (0.0 to 1.0)
- If no clear intent matches, default to PRODUCT_RECOMMENDATION with minimal payload
- Always return valid JSON that matches the schema`;

/**
 * Detects buyer intent from a user message using AI
 */
export async function detectBuyerIntentWithAI(
  message: string,
  context?: { history?: Array<{ role: string; content: string }> }
): Promise<{ success: true; intent: BuyerIntent } | { success: false; error: string }> {
  if (!isAIConfigured()) {
    return {
      success: false,
      error: 'AI is not configured. Falling back to basic intent detection.',
    };
  }

  try {
    const recentHistory = context?.history?.slice(-4) || [];
    const historyText =
      recentHistory.length > 0
        ? recentHistory.map((entry) => `${entry.role}: ${entry.content}`).join('\n')
        : 'No recent chat history.';

    const completion = await generateChatCompletion(
      [
        {
          role: 'system',
          content: BUYER_INTENT_DETECTION_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: `Recent chat history:\n${historyText}\n\nCurrent user message:\n${message}`,
        },
      ],
      {
        temperature: 0.3,
        maxTokens: 500,
        topP: 0.9,
      }
    );

    // Extract JSON from the response
    const jsonCandidate = extractJsonCandidate(completion.text);
    const parsed = buyerIntentSchema.safeParse(JSON.parse(jsonCandidate));

    if (parsed.success) {
      return {
        success: true,
        intent: parsed.data,
      };
    } else {
      console.error('AI intent detection parsing error:', parsed.error);
      return {
        success: false,
        error: 'Failed to parse AI intent response. Using fallback.',
      };
    }
  } catch (error) {
    console.error('AI intent detection error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'AI intent detection failed',
    };
  }
}

/**
 * Creates a fallback intent when AI detection fails
 */
export function createFallbackBuyerIntent(message: string): BuyerIntent {
  const normalized = message.toLowerCase();

  // Check for refund-related keywords
  if (
    /\b(refund|return|money back|refund policy|cancel order|wrong item|defective|damaged|not received)\b/.test(
      normalized
    )
  ) {
    return {
      intent: 'REFUND_REQUEST',
      payload: {
        reason: 'other',
        reasonDescription: message,
      },
      metadata: {
        confidenceScore: 0.6,
        isPartial: true,
        source: 'fallback_detection',
      },
    };
  }

  // Check for policy-related keywords
  if (
    /\b(policy|how to|what is|can i|rules|regulations|shipping|return|payment|account)\b/.test(
      normalized
    )
  ) {
    return {
      intent: 'POLICY_QA',
      payload: {
        question: message,
        domain: 'other',
        confidence: 'ambiguous',
      },
      metadata: {
        confidenceScore: 0.6,
        isPartial: true,
        source: 'fallback_detection',
      },
    };
  }

  // Default to product recommendation
  return {
    intent: 'PRODUCT_RECOMMENDATION',
    payload: {
      attributes: [],
    },
    metadata: {
      confidenceScore: 0.5,
      isPartial: true,
      source: 'fallback_detection',
    },
  };
}

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