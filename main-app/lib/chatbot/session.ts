import type { ChatbotRole } from '@/lib/chatbot/types';

export const CHATBOT_OPEN_STORAGE_KEY_PREFIX = 'buysmart.chat-widget-open';
export const CHATBOT_MESSAGES_STORAGE_KEY_PREFIX = 'buysmart.chat-widget-messages';
export const CHATBOT_CONTEXT_STORAGE_KEY_PREFIX = 'buysmart.chat-widget-context';
export const CHATBOT_AUTH_MARKER_STORAGE_KEY_PREFIX = 'buysmart.chat-widget-auth-marker';
export const CHATBOT_MODE_STORAGE_KEY_PREFIX = 'buysmart.chat-widget-mode';

const CHATBOT_ROLES: ChatbotRole[] = ['buyer', 'seller', 'admin'];

export function getChatbotStorageKeys(role: ChatbotRole) {
  return {
    open: `${CHATBOT_OPEN_STORAGE_KEY_PREFIX}.${role}`,
    messages: `${CHATBOT_MESSAGES_STORAGE_KEY_PREFIX}.${role}`,
    context: `${CHATBOT_CONTEXT_STORAGE_KEY_PREFIX}.${role}`,
    authMarker: `${CHATBOT_AUTH_MARKER_STORAGE_KEY_PREFIX}.${role}`,
    mode: `${CHATBOT_MODE_STORAGE_KEY_PREFIX}.${role}`,
  };
}

export function clearChatbotSessionStorage() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    CHATBOT_ROLES.forEach((role) => {
      const keys = getChatbotStorageKeys(role);
      window.sessionStorage.removeItem(keys.open);
      window.sessionStorage.removeItem(keys.messages);
      window.sessionStorage.removeItem(keys.context);
      window.sessionStorage.removeItem(keys.authMarker);
      window.sessionStorage.removeItem(keys.mode);
    });
  } catch {
    // Ignore storage failures and keep auth flows functional.
  }
}
