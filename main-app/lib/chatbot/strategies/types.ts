import type { ChatContext, ChatAPIResponse, UIMessage } from '@/lib/chatbot/types';

export interface ChatMessageSendOptions {
  intentOutput?: unknown;
  evidenceImages?: string[];
}

export interface ChatSendResult {
  response: ChatAPIResponse;
  userMessage: UIMessage;
  assistantMessage: UIMessage;
}

export interface ChatStrategy {
  handle(
    message: string,
    context: ChatContext,
    options?: ChatMessageSendOptions,
  ): Promise<ChatSendResult>;
}
