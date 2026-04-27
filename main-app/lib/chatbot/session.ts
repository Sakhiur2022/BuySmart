export const CHATBOT_OPEN_STORAGE_KEY = 'buysmart.buyer-chat-widget-open';
export const CHATBOT_MESSAGES_STORAGE_KEY = 'buysmart.buyer-chat-widget-messages';
export const CHATBOT_CONTEXT_STORAGE_KEY = 'buysmart.buyer-chat-widget-context';
export const CHATBOT_AUTH_MARKER_STORAGE_KEY = 'buysmart.buyer-chat-widget-auth-marker';

export function clearChatbotSessionStorage() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.removeItem(CHATBOT_OPEN_STORAGE_KEY);
    window.sessionStorage.removeItem(CHATBOT_MESSAGES_STORAGE_KEY);
    window.sessionStorage.removeItem(CHATBOT_CONTEXT_STORAGE_KEY);
    window.sessionStorage.removeItem(CHATBOT_AUTH_MARKER_STORAGE_KEY);
  } catch {
    // Ignore storage failures and keep auth flows functional.
  }
}
