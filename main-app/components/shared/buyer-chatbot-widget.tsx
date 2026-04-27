'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { Loader2, MessageCircle, Send, Sparkles, X } from 'lucide-react';
import type {
  ChatAPIRequest,
  ChatAPIResponse,
  ChatContext,
  ChatMessage,
  UIMessage,
} from '@/lib/chatbot/types';
import { createClient } from '@/lib/supabase/client';
import {
  CHATBOT_AUTH_MARKER_STORAGE_KEY,
  CHATBOT_CONTEXT_STORAGE_KEY,
  CHATBOT_MESSAGES_STORAGE_KEY,
  CHATBOT_OPEN_STORAGE_KEY,
  clearChatbotSessionStorage,
} from '@/lib/chatbot/session';

const DEFAULT_CONTEXT: ChatContext = {
  category: null,
  price_max: null,
  lastOrderId: null,
  history: [],
};

const GREETING_MESSAGE: UIMessage = {
  id: 'assistant-greeting',
  role: 'assistant',
  text: 'Hi there! How can I help you today?',
};

const FALLBACK_REPLY =
  "I couldn't reach the BuySmart assistant just now. Please try again in a moment, and if this keeps happening we can connect you with support.";

function createMessageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createFallbackContext(previousContext: ChatContext, message: string): ChatContext {
  return {
    ...previousContext,
    history: [
      ...previousContext.history,
      { role: 'user' as const, content: message },
      { role: 'assistant' as const, content: FALLBACK_REPLY },
    ] as ChatMessage[],
  };
}

function isValidContext(value: unknown): value is ChatContext {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ChatContext>;
  return (
    Array.isArray(candidate.history) &&
    ('category' in candidate ? candidate.category === null || typeof candidate.category === 'string' : true) &&
    ('price_max' in candidate
      ? candidate.price_max === null || typeof candidate.price_max === 'number'
      : true) &&
    ('lastOrderId' in candidate
      ? candidate.lastOrderId === null || typeof candidate.lastOrderId === 'string'
      : true)
  );
}

function isValidMessage(value: unknown): value is UIMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<UIMessage>;
  return (
    typeof candidate.id === 'string' &&
    (candidate.role === 'user' || candidate.role === 'assistant') &&
    typeof candidate.text === 'string'
  );
}

function isChatApiResponse(value: unknown): value is ChatAPIResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ChatAPIResponse>;
  return typeof candidate.reply === 'string' && isValidContext(candidate.updatedContext);
}

function formatCurrency(amount: number) {
  return `BDT ${amount.toLocaleString()}`;
}

function buildAssistantMessage(response: ChatAPIResponse): UIMessage {
  return {
    id: createMessageId('assistant'),
    role: 'assistant',
    text: response.reply,
    products: response.products,
    order: response.order,
    policyText: response.policyText,
    isEscalation: response.isEscalation,
  };
}

async function getAuthMarker(supabase: ReturnType<typeof createClient>) {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user?.id) {
      return 'guest';
    }

    return `user:${data.user.id}`;
  } catch {
    return 'guest';
  }
}

export default function BuyerChatbotWidget() {
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const hasInteractedRef = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [draftMessage, setDraftMessage] = useState('');
  const [messages, setMessages] = useState<UIMessage[]>([GREETING_MESSAGE]);
  const [chatContext, setChatContext] = useState<ChatContext>(DEFAULT_CONTEXT);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isHiddenRoute =
    pathname.startsWith('/auth') ||
    pathname.startsWith('/seller') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api');

  const shouldRender = !isHiddenRoute;

  const shouldLiftWidget =
    pathname === '/buyer/cart' ||
    pathname === '/buyer/checkout' ||
    pathname === '/buyer/order-confirmation' ||
    pathname.startsWith('/orders/');

  const positionClassName = shouldLiftWidget
    ? 'bottom-28 right-4 md:bottom-10 md:right-8'
    : 'bottom-20 right-4 md:bottom-8 md:right-6';

  function resetChatSession(nextAuthMarker?: string, preserveOpenState = false) {
    setMessages([GREETING_MESSAGE]);
    setChatContext(DEFAULT_CONTEXT);
    setDraftMessage('');
    setErrorMessage(null);
    setIsSending(false);
    if (!preserveOpenState) {
      setIsOpen(false);
    }
    clearChatbotSessionStorage();

    if (nextAuthMarker) {
      try {
        sessionStorage.setItem(CHATBOT_AUTH_MARKER_STORAGE_KEY, nextAuthMarker);
      } catch {
        // Ignore storage failures and keep the widget functional.
      }
    }
  }

  useEffect(() => {
    let isActive = true;

    const hydrateChatState = async () => {
      const authMarker = await getAuthMarker(supabase);
      if (!isActive) {
        return;
      }

      try {
        const storedOpenState = sessionStorage.getItem(CHATBOT_OPEN_STORAGE_KEY);
        const storedMessages = sessionStorage.getItem(CHATBOT_MESSAGES_STORAGE_KEY);
        const storedContext = sessionStorage.getItem(CHATBOT_CONTEXT_STORAGE_KEY);
        const storedAuthMarker = sessionStorage.getItem(CHATBOT_AUTH_MARKER_STORAGE_KEY);

        if (storedAuthMarker && storedAuthMarker !== authMarker) {
          resetChatSession(authMarker, hasInteractedRef.current);
        } else {
          if (!hasInteractedRef.current && storedOpenState === 'true') {
            setIsOpen(true);
          }

          if (storedMessages) {
            const parsedMessages = JSON.parse(storedMessages) as unknown;
            if (Array.isArray(parsedMessages)) {
              const safeMessages = parsedMessages.filter(isValidMessage);
              if (safeMessages.length > 0) {
                setMessages(safeMessages);
              }
            }
          }

          if (storedContext) {
            const parsedContext = JSON.parse(storedContext) as unknown;
            if (isValidContext(parsedContext)) {
              setChatContext({
                category: parsedContext.category ?? null,
                price_max: parsedContext.price_max ?? null,
                lastOrderId: parsedContext.lastOrderId ?? null,
                history: parsedContext.history.slice(-20),
              });
            }
          }

          sessionStorage.setItem(CHATBOT_AUTH_MARKER_STORAGE_KEY, authMarker);
        }
      } catch {
        setIsOpen(false);
        setMessages([GREETING_MESSAGE]);
        setChatContext(DEFAULT_CONTEXT);
      } finally {
        if (isActive) {
          setHasLoaded(true);
        }
      }
    };

    void hydrateChatState();

    return () => {
      isActive = false;
    };
  }, [supabase]);

  useEffect(() => {
    if (!hasLoaded) {
      return;
    }

    try {
      sessionStorage.setItem(CHATBOT_OPEN_STORAGE_KEY, String(isOpen));
      sessionStorage.setItem(CHATBOT_MESSAGES_STORAGE_KEY, JSON.stringify(messages));
      sessionStorage.setItem(CHATBOT_CONTEXT_STORAGE_KEY, JSON.stringify(chatContext));
    } catch {
      // Ignore storage failures and keep the widget functional.
    }
  }, [chatContext, hasLoaded, isOpen, messages]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        const authMarker = session?.user?.id ? `user:${session.user.id}` : 'guest';
        resetChatSession(authMarker);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [isOpen, isSending, messages]);

  async function handleSend() {
    const message = draftMessage.trim();
    if (!message || isSending) {
      return;
    }

    const userMessage: UIMessage = {
      id: createMessageId('user'),
      role: 'user',
      text: message,
    };

    const requestPayload: ChatAPIRequest = {
      message,
      context: chatContext,
    };

    setMessages((currentMessages) => [...currentMessages, userMessage]);
    setDraftMessage('');
    setErrorMessage(null);
    setIsSending(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      });

      const body = (await response.json().catch(() => null)) as
        | ChatAPIResponse
        | { error?: string }
        | null;

      if (!response.ok) {
        const apiError =
          body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
            ? body.error
            : 'Unable to send message.';
        throw new Error(apiError);
      }

      if (!isChatApiResponse(body)) {
        throw new Error('The chat service returned an unexpected response.');
      }

      setMessages((currentMessages) => [...currentMessages, buildAssistantMessage(body)]);
      setChatContext(body.updatedContext);
    } catch (error) {
      const nextContext = createFallbackContext(chatContext, message);
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: createMessageId('assistant-fallback'),
          role: 'assistant',
          text: FALLBACK_REPLY,
          isEscalation: true,
        },
      ]);
      setChatContext(nextContext);
      setErrorMessage(error instanceof Error ? error.message : 'Unable to send message.');
    } finally {
      setIsSending(false);
    }
  }

  if (!shouldRender) {
    return null;
  }

  return (
    <div
      className={`pointer-events-none fixed ${positionClassName} z-30 flex flex-col items-end gap-3 font-sans`}
    >
      <div
        className={`w-[min(20rem,calc(100vw-1.5rem))] origin-bottom-right overflow-hidden rounded-2xl border border-rose-100 bg-white shadow-2xl ring-1 ring-black/5 transition-all duration-300 ease-out sm:w-80 md:w-[19rem] ${
          isOpen
            ? 'pointer-events-auto visible translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none invisible translate-y-4 scale-95 opacity-0'
        }`}
        aria-hidden={!isOpen}
      >
        <div className="flex items-start justify-between gap-3 bg-linear-to-r from-rose-500 via-rose-500 to-pink-500 px-4 py-3 text-white">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-white/80">
              <Sparkles className="h-4 w-4" />
              Support
            </div>
            <h2 className="text-lg font-semibold leading-none">Chat with us</h2>
            <p className="text-xs text-white/85 sm:text-sm">
              BuySmart assistant - typically replies in minutes
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            onMouseDown={() => {
              hasInteractedRef.current = true;
            }}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
            aria-label="Close chat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex h-[min(22rem,calc(100dvh-12rem))] flex-col bg-rose-50/40 sm:h-[min(24rem,calc(100dvh-12rem))]">
          <div
            ref={scrollRef}
            className="flex-1 space-y-4 overflow-y-auto px-4 py-3"
            aria-live="polite"
          >
            {messages.map((message, index) => {
              const isAssistant = message.role === 'assistant';
              const showAvatar = isAssistant && index === 0;

              return (
                <div
                  key={message.id}
                  className={`flex items-start gap-3 ${
                    isAssistant ? '' : 'justify-end'
                  }`}
                >
                  {showAvatar ? (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-rose-600 shadow-sm ring-1 ring-rose-100">
                      <div className="relative h-full w-full">
                        <Image
                          src="/icons/kitty_thinking.png"
                          alt="Thinking kitty illustration"
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      </div>
                    </div>
                  ) : null}

                  <div className={`max-w-[82%] space-y-2 ${isAssistant ? '' : 'items-end'}`}>
                    <div
                      className={`rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ring-1 ${
                        isAssistant
                          ? 'rounded-tl-md bg-white text-slate-700 ring-slate-100'
                          : 'rounded-tr-md bg-rose-500 text-white ring-rose-300/60'
                      }`}
                    >
                      <p>{message.text}</p>

                      {message.products && message.products.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {message.products.map((product) => (
                            <div
                              key={product.id}
                              className="rounded-xl border border-rose-100 bg-rose-50/70 px-3 py-2 text-slate-700"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-medium text-slate-900">{product.name}</p>
                                  <p className="text-xs text-slate-500">
                                    {product.badge ?? product.category}
                                  </p>
                                </div>
                                <p className="whitespace-nowrap text-sm font-semibold text-rose-600">
                                  {formatCurrency(product.price)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {message.policyText ? (
                        <div className="mt-3 whitespace-pre-line rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-slate-700">
                          {message.policyText}
                        </div>
                      ) : null}

                      {message.isEscalation ? (
                        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                          Support follow-up has been flagged.
                        </div>
                      ) : null}
                    </div>
                    <p className={`px-1 text-[11px] text-slate-400 ${isAssistant ? '' : 'text-right'}`}>
                      Just now
                    </p>
                  </div>
                </div>
              );
            })}

            {isSending ? (
              <div className="flex items-start gap-3">
                <div className="rounded-2xl rounded-tl-md bg-white px-4 py-3 text-sm text-slate-500 shadow-sm ring-1 ring-slate-100">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Thinking...
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-t border-rose-100 bg-white px-4 py-3">
            {errorMessage ? (
              <p className="mb-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {errorMessage}
              </p>
            ) : null}

            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 shadow-sm focus-within:border-rose-300 focus-within:ring-2 focus-within:ring-rose-100">
              <input
                type="text"
                placeholder="Type a message..."
                value={draftMessage}
                onChange={(event) => setDraftMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
                disabled={isSending}
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Type a message"
              />
              <button
                type="button"
                onClick={() => {
                  void handleSend();
                }}
                disabled={isSending || !draftMessage.trim()}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white transition-transform hover:-translate-y-0.5 hover:bg-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-rose-300"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="relative pointer-events-auto">
        <button
          type="button"
          onClick={() => {
            hasInteractedRef.current = true;
            setIsOpen((current) => !current);
          }}
          className={`relative flex h-14 w-14 items-center justify-center rounded-full bg-linear-to-r from-rose-500 via-rose-500 to-pink-500 text-white shadow-2xl shadow-rose-500/30 transition-transform duration-300 hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-200 ${
            hasLoaded && !isOpen ? 'animate-[bounce_1.4s_ease-in-out_1]' : ''
          }`}
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Close chat' : 'Open chat'}
        >
          <MessageCircle className="h-6 w-6" />

          {!isOpen ? (
            <span className="absolute right-0 top-0 h-3 w-3 rounded-full bg-red-500 ring-2 ring-white">
              <span className="absolute inset-0 animate-ping rounded-full bg-red-500 opacity-75" />
            </span>
          ) : null}
        </button>
      </div>
    </div>
  );
}
