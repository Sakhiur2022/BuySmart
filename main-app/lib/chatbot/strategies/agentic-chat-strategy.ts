import type { ChatAPIResponse, ChatContext, UIMessage, ChatbotRole } from '@/lib/chatbot/types';
import type { ChatStrategy, ChatMessageSendOptions, ChatSendResult } from './types';

function createMessageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildAssistantMessage(response: ChatAPIResponse): UIMessage {
  const replyText = response.reply;

  return {
    id: createMessageId('assistant'),
    role: 'assistant',
    text: replyText,
    createdAt: Date.now(),
    products: response.products,
    order: response.order,
    policyText: response.policyText,
    isEscalation: response.isEscalation,
  };
}

function buildUserMessage(message: string): UIMessage {
  return {
    id: createMessageId('user'),
    role: 'user',
    text: message,
    createdAt: Date.now(),
  };
}

export class AgenticChatStrategy implements ChatStrategy {
  constructor(
    private apiEndpoint: string,
    private role: ChatbotRole,
  ) {}

  async handle(
    message: string,
    context: ChatContext,
    options?: ChatMessageSendOptions,
  ): Promise<ChatSendResult> {
    const userMessage = buildUserMessage(message);

    const requestPayload = {
      message,
      context,
      role: this.role,
      intentOutput: options?.intentOutput,
      evidenceImages: options?.evidenceImages,
    };

    const response = await fetch(this.apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${errorText}`);
    }

    const responseData = (await response.json()) as ChatAPIResponse;
    const assistantMessage = buildAssistantMessage(responseData);

    return {
      response: responseData,
      userMessage,
      assistantMessage,
    };
  }
}
