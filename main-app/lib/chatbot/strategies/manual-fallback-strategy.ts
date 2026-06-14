import type { ChatAPIResponse, ChatContext, UIMessage, ChatbotRole } from '@/lib/chatbot/types';
import type { ChatStrategy, ChatMessageSendOptions, ChatSendResult } from './types';

const FALLBACK_REPLY =
  "I couldn't reach the BuySmart assistant just now. Please try again in a moment, and if this keeps happening we can connect you with support.";

function createMessageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildUserMessage(message: string): UIMessage {
  return {
    id: createMessageId('user'),
    role: 'user',
    text: message,
    createdAt: Date.now(),
  };
}

function buildFallbackAssistantMessage(): UIMessage {
  return {
    id: createMessageId('assistant'),
    role: 'assistant',
    text: FALLBACK_REPLY,
    createdAt: Date.now(),
    isEscalation: true,
  };
}

export class ManualFallbackStrategy implements ChatStrategy {
  constructor(private role: ChatbotRole) {}

  async handle(
    message: string,
    context: ChatContext,
    _options?: ChatMessageSendOptions,
  ): Promise<ChatSendResult> {
    // Manual fallback mode: no API call, immediate local response
    const userMessage = buildUserMessage(message);
    const assistantMessage = buildFallbackAssistantMessage();

    const response: ChatAPIResponse = {
      reply: FALLBACK_REPLY,
      intent: 'SUPPORT',
      updatedContext: context,
      isEscalation: true,
    };

    return {
      response,
      userMessage,
      assistantMessage,
    };
  }
}
