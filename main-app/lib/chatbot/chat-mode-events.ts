import type { ChatbotRole } from '@/lib/chatbot/types';

export type ChatMode = 'agentic' | 'manual-fallback';

export type ModeChangedEvent = {
  newMode: ChatMode;
  previousMode: ChatMode;
  timestamp: number;
  role: ChatbotRole;
};

export type ChatModeEventListener = (event: ModeChangedEvent) => void;

export class ChatModeEventEmitter {
  private listeners: Map<string, Set<ChatModeEventListener>> = new Map();

  on(eventType: 'mode_changed', callback: ChatModeEventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    const callbacks = this.listeners.get(eventType)!;
    callbacks.add(callback);

    // Return unsubscribe function
    return () => {
      callbacks.delete(callback);
    };
  }

  emit(eventType: 'mode_changed', event: ModeChangedEvent): void {
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      callbacks.forEach((callback) => callback(event));
    }
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}

const emittersByRole: Map<ChatbotRole, ChatModeEventEmitter> = new Map();

export function getChatModeEventEmitter(role: ChatbotRole): ChatModeEventEmitter {
  if (!emittersByRole.has(role)) {
    emittersByRole.set(role, new ChatModeEventEmitter());
  }

  return emittersByRole.get(role)!;
}
