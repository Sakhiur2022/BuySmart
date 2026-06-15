import type { ChatbotRole } from '@/lib/chatbot/types';
import type { ChatStrategy } from './strategies/types';
import type { ChatMode } from '@/lib/chatbot/chat-mode-events';
import { AgenticChatStrategy } from './strategies/agentic-chat-strategy';
import { ManualFallbackStrategy } from './strategies/manual-fallback-strategy';

export class ChatModeHandler {
  private agenticStrategy: ChatStrategy;
  private fallbackStrategy: ChatStrategy;

  constructor(
    private apiEndpoint: string,
    private role: ChatbotRole,
  ) {
    this.agenticStrategy = new AgenticChatStrategy(apiEndpoint, role);
    this.fallbackStrategy = new ManualFallbackStrategy(role);
  }

  getStrategy(mode: ChatMode): ChatStrategy {
    return mode === 'agentic' ? this.agenticStrategy : this.fallbackStrategy;
  }

  getAgenticStrategy(): ChatStrategy {
    return this.agenticStrategy;
  }

  getFallbackStrategy(): ChatStrategy {
    return this.fallbackStrategy;
  }
}
