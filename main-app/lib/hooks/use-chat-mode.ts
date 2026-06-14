'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChatbotRole } from '@/lib/chatbot/types';
import type { ChatMode, ChatModeEventEmitter } from '@/lib/chatbot/chat-mode-events';
import { getChatModeEventEmitter } from '@/lib/chatbot/chat-mode-events';
import { getChatbotStorageKeys } from '@/lib/chatbot/session';

export type UseChatModeReturn = {
  currentMode: ChatMode;
  isAgentic: boolean;
  toggle: (newMode?: ChatMode) => void;
  reset: () => void;
  emitter: ChatModeEventEmitter;
};

export function useChatMode(role: ChatbotRole): UseChatModeReturn {
  const [currentMode, setCurrentMode] = useState<ChatMode>('agentic');
  const emitter = useMemo(() => getChatModeEventEmitter(role), [role]);
  const storageKeys = useMemo(() => getChatbotStorageKeys(role), [role]);

  // Hydrate mode from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(storageKeys.mode);
      if (stored && (stored === 'agentic' || stored === 'manual-fallback')) {
        setCurrentMode(stored as ChatMode);
      }
    } catch {
      // Ignore storage failures; default to 'agentic'
    }
  }, [storageKeys.mode]);

  // Persist mode to sessionStorage on every change
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKeys.mode, currentMode);
    } catch {
      // Ignore storage failures and keep the widget functional
    }
  }, [currentMode, storageKeys.mode]);

  const toggle = useCallback(
    (newMode?: ChatMode) => {
      setCurrentMode((previousMode) => {
        const nextMode = newMode ?? (previousMode === 'agentic' ? 'manual-fallback' : 'agentic');

        // Emit event if mode actually changed
        if (nextMode !== previousMode) {
          emitter.emit('mode_changed', {
            newMode: nextMode,
            previousMode,
            timestamp: Date.now(),
            role,
          });
        }

        return nextMode;
      });
    },
    [emitter, role],
  );

  const reset = useCallback(() => {
    setCurrentMode((previousMode) => {
      if (previousMode !== 'agentic') {
        emitter.emit('mode_changed', {
          newMode: 'agentic',
          previousMode,
          timestamp: Date.now(),
          role,
        });
      }

      return 'agentic';
    });
  }, [emitter, role]);

  const isAgentic = useMemo(() => currentMode === 'agentic', [currentMode]);

  return {
    currentMode,
    isAgentic,
    toggle,
    reset,
    emitter,
  };
}
