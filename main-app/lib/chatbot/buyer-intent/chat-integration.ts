import type { ChatContext } from '@/lib/chatbot/types';
import type { BuyerIntent } from '@/lib/chatbot/buyer-intent/types';
import { detectBuyerIntentWithAI, createFallbackBuyerIntent } from './ai-detection';

/**
 * Enhanced chat request payload that includes AI-powered intent detection
 */
export interface EnhancedChatRequest {
  message: string;
  context?: ChatContext;
  enableAIIntentDetection?: boolean;
}

/**
 * Processes a chat message with optional AI intent detection
 * Returns the complete payload for the chat API
 */
export async function prepareChatRequest(
  request: EnhancedChatRequest
): Promise<{
  message: string;
  context?: ChatContext;
  intentOutput?: BuyerIntent;
  recommendationContext?: any;
  usedAIDetection: boolean;
}> {
  const { message, context, enableAIIntentDetection = true } = request;

  // If AI intent detection is disabled, return basic request
  if (!enableAIIntentDetection) {
    return {
      message,
      context,
      usedAIDetection: false,
    };
  }

  // Try AI intent detection
  const detectionResult = await detectBuyerIntentWithAI(message, context);

  if (detectionResult.success) {
    const intent = detectionResult.intent;

    // Build recommendation context if this is a product recommendation intent
    let recommendationContext;
    if (intent.intent === 'PRODUCT_RECOMMENDATION' && intent.payload) {
      recommendationContext = {
        candidates: [], // Can be populated with product candidates if available
        contextSummary: message,
        maxResults: 10,
      };
    }

    return {
      message,
      context,
      intentOutput: intent,
      recommendationContext,
      usedAIDetection: true,
    };
  } else {
    // Use fallback intent if AI detection fails
    const fallbackIntent = createFallbackBuyerIntent(message);

    let recommendationContext;
    if (fallbackIntent.intent === 'PRODUCT_RECOMMENDATION') {
      recommendationContext = {
        candidates: [],
        contextSummary: message,
        maxResults: 10,
      };
    }

    return {
      message,
      context,
      intentOutput: fallbackIntent,
      recommendationContext,
      usedAIDetection: false, // AI detection failed, used fallback
    };
  }
}

/**
 * Sends a chat message with AI intent detection to the buyer chat API
 */
export async function sendBuyerChatWithAI(
  request: EnhancedChatRequest
): Promise<{
  success: boolean;
  data?: any;
  error?: string;
  usedAIDetection: boolean;
}> {
  try {
    const preparedRequest = await prepareChatRequest(request);

    const response = await fetch('/api/buyer/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preparedRequest),
    });

    if (!response.ok) {
      throw new Error(`Chat API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      success: true,
      data,
      usedAIDetection: preparedRequest.usedAIDetection,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Chat request failed',
      usedAIDetection: false,
    };
  }
}

/**
 * Client-side utility for enhanced chat with AI intent detection
 * This can be used directly in React components
 */
export class EnhancedBuyerChat {
  private context: ChatContext = {
    category: null,
    price_max: null,
    lastOrderId: null,
    history: [],
  };

  constructor(initialContext?: Partial<ChatContext>) {
    if (initialContext) {
      this.context = { ...this.context, ...initialContext };
    }
  }

  /**
   * Update the chat context
   */
  updateContext(updates: Partial<ChatContext>) {
    this.context = { ...this.context, ...updates };
  }

  /**
   * Add a message to the conversation history
   */
  addMessage(role: 'user' | 'assistant', content: string) {
    this.context.history = [
      ...this.context.history,
      { role, content },
    ].slice(-20); // Keep last 20 messages
  }

  /**
   * Send a message with AI intent detection
   */
  async sendMessage(
    message: string,
    options?: { enableAIIntentDetection?: boolean }
  ) {
    // Add user message to history
    this.addMessage('user', message);

    const result = await sendBuyerChatWithAI({
      message,
      context: this.context,
      enableAIIntentDetection: options?.enableAIIntentDetection ?? true,
    });

    if (result.success && result.data) {
      // Add assistant response to history
      this.addMessage('assistant', result.data.reply || '');

      // Update context from response
      if (result.data.updatedContext) {
        this.context = result.data.updatedContext;
      }
    }

    return result;
  }

  /**
   * Get current context
   */
  getContext() {
    return { ...this.context };
  }

  /**
   * Reset conversation history
   */
  resetHistory() {
    this.context.history = [];
  }
}