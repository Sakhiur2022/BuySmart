'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Variants } from 'framer-motion';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
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
import { useChatToolStatus } from '@/lib/hooks/use-chat-tool-status';
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
  createdAt: Date.now(),
};

const FALLBACK_REPLY =
  "I couldn't reach the BuySmart assistant just now. Please try again in a moment, and if this keeps happening we can connect you with support.";

const RECOMMENDATION_TOAST_DELAY_MS = 1800;
const REFUND_ORDER_FETCH_TOAST_DELAY_MS = 2000;
const REFUND_SUBMIT_TOAST_DELAY_MS = 1200;

function createMessageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

type ToastVariant = 'success' | 'error' | 'info';

type Toast = {
  id: string;
  message: string;
  variant: ToastVariant;
  actionLabel?: string;
  onAction?: () => void;
};

function ToastList({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (!toasts.length) {
    return null;
  }

  return (
    <div className="pointer-events-auto fixed bottom-4 left-4 z-50 flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-3 sm:w-80">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-xl border bg-white px-4 py-3 text-sm shadow-xl ring-1 ring-black/5 ${
            toast.variant === 'success'
              ? 'border-emerald-100 text-emerald-900'
              : toast.variant === 'error'
                ? 'border-rose-100 text-rose-900'
                : 'border-slate-100 text-slate-900'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="text-xs font-semibold text-slate-500 transition hover:text-slate-700"
            >
              Dismiss
            </button>
          </div>
          {toast.actionLabel && toast.onAction ? (
            <button
              type="button"
              onClick={() => toast.onAction?.()}
              className="mt-2 inline-flex items-center justify-center rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
            >
              {toast.actionLabel}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
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
    ('category' in candidate
      ? candidate.category === null || typeof candidate.category === 'string'
      : true) &&
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
    typeof candidate.text === 'string' &&
    (typeof candidate.createdAt === 'number' || typeof candidate.createdAt === 'undefined')
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

function formatRelativeTime(timestamp: number, now: number) {
  const diffInSeconds = Math.round((timestamp - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const seconds = diffInSeconds;
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);

  if (Math.abs(seconds) < 60) return rtf.format(seconds, 'second');
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour');
  return rtf.format(days, 'day');
}

function getRefundErrorMessage(code: string | undefined) {
  switch (code) {
    case 'ORDER_NOT_FOUND':
      return 'We could not find that order. Try a different order.';
    case 'REFUND_CONFLICT':
      return 'A refund request already exists for that order.';
    case 'REFUND_INELIGIBLE_STATUS':
      return 'That order is not eligible for a refund yet.';
    case 'REFUND_INELIGIBLE_PAYMENT_STATUS':
      return 'That payment is not eligible for a refund yet.';
    case 'REFUND_INVALID_AMOUNT':
      return 'The refund amount is not valid for this order.';
    case 'REFUND_VALIDATION_ERROR':
      return 'We need a few more details before submitting the refund.';
    case 'REFUND_TIMEOUT':
      return 'The refund service is taking too long. Please try again.';
    default:
      return 'We could not process the refund right now.';
  }
}

function buildAssistantMessage(response: ChatAPIResponse): UIMessage {
  return {
    id: createMessageId('assistant'),
    role: 'assistant',
    text: response.reply,
    createdAt: Date.now(),
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
  const inputRef = useRef<HTMLInputElement | null>(null);
  const hasInteractedRef = useRef(false);
  const shouldReduceMotion = useReducedMotion();
  const [isOpen, setIsOpen] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [draftMessage, setDraftMessage] = useState('');
  const [messages, setMessages] = useState<UIMessage[]>([GREETING_MESSAGE]);
  const [chatContext, setChatContext] = useState<ChatContext>(DEFAULT_CONTEXT);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toolStatus = useChatToolStatus();

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

  function addToast(toast: Omit<Toast, 'id'> & { durationMs?: number }) {
    const id = createMessageId('toast');
    const durationMs = toast.durationMs ?? 5000;
    setToasts((prev) => [
      ...prev,
      {
        id,
        message: toast.message,
        variant: toast.variant,
        actionLabel: toast.actionLabel,
        onAction: toast.onAction,
      },
    ]);

    if (durationMs > 0) {
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== id));
      }, durationMs);
    }

    return id;
  }

  function dismissToast(id: string) {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }

  const panelVariants: Variants = shouldReduceMotion
    ? {
        open: { opacity: 1 },
        closed: { opacity: 0 },
      }
    : {
        open: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
        },
        closed: {
          opacity: 0,
          y: 16,
          scale: 0.96,
          transition: { duration: 0.18, ease: [0.4, 0, 1, 1] },
        },
      };

  const messageVariants: Variants = shouldReduceMotion
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
      }
    : {
        hidden: { opacity: 0, y: 8 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } },
      };

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
              const safeMessages = parsedMessages.filter(isValidMessage).map((message) => ({
                ...message,
                createdAt: message.createdAt ?? Date.now(),
              }));
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

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 60000);

    return () => {
      window.clearInterval(timer);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const focusTimer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  async function handleSend(overrideMessage?: string) {
    const message = (overrideMessage ?? draftMessage).trim();
    if (!message || isSending) {
      return;
    }

    const userMessage: UIMessage = {
      id: createMessageId('user'),
      role: 'user',
      text: message,
      createdAt: Date.now(),
    };

    const requestPayload: ChatAPIRequest = {
      message,
      context: chatContext,
    };

    setMessages((currentMessages) => [...currentMessages, userMessage]);
    setDraftMessage('');
    setErrorMessage(null);
    setLastFailedMessage(null);
    setIsSending(true);
    toolStatus.updateStatus('resolving_intent');

    const normalizedMessage = message.toLowerCase();
    const shouldShowRecommendationToast = /\b(recommend|suggest|gift|browse|discover)\b/.test(
      normalizedMessage,
    );
    const shouldWatchRefundFlow = /\b(refund|return)\b/.test(normalizedMessage);
    let recommendationToastId: string | null = null;
    let recommendationToastTimer: number | null = null;
    let refundOrdersToastId: string | null = null;
    let refundOrdersToastTimer: number | null = null;
    let refundSubmitToastId: string | null = null;
    let refundSubmitToastTimer: number | null = null;

    if (shouldShowRecommendationToast) {
      recommendationToastTimer = window.setTimeout(() => {
        recommendationToastId = addToast({
          message: 'Still fetching recommendations...',
          variant: 'info',
          durationMs: 4000,
        });
      }, RECOMMENDATION_TOAST_DELAY_MS);
    }

    if (shouldWatchRefundFlow) {
      refundOrdersToastTimer = window.setTimeout(() => {
        refundOrdersToastId = addToast({
          message: 'Fetching your recent orders...',
          variant: 'info',
          durationMs: 0,
        });
      }, REFUND_ORDER_FETCH_TOAST_DELAY_MS);

      refundSubmitToastTimer = window.setTimeout(() => {
        refundSubmitToastId = addToast({
          message: 'Submitting your refund...',
          variant: 'info',
          durationMs: 0,
        });
      }, REFUND_SUBMIT_TOAST_DELAY_MS);
    }

    try {
      toolStatus.updateStatus('invoking_tool');
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      });

      toolStatus.updateStatus('awaiting_result');
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

      if (body.toolCall?.toolName?.startsWith('refund_')) {
        const toolName = body.toolCall.toolName;
        const toolError = body.toolError;
        const toolDetails = toolError?.details as
          | { mascotTrigger?: boolean; kind?: string }
          | undefined;

        if (toolError) {
          if (toolDetails?.mascotTrigger) {
            addToast({
              message: 'Refunds are temporarily unavailable. Please use Orders to submit manually.',
              variant: 'error',
              durationMs: 0,
              actionLabel: 'Open Orders',
              onAction: () => {
                window.location.href = '/buyer/orders';
              },
            });
          } else {
            addToast({
              message: getRefundErrorMessage(toolError.code),
              variant: 'error',
              durationMs: toolDetails?.kind === 'business' ? 6000 : 8000,
            });
          }
        }

        if (toolName === 'refund_orders_fetch' && !toolError) {
          // Orders are ready; loading toasts are dismissed below.
        }
      }

      setMessages((currentMessages) => [...currentMessages, buildAssistantMessage(body)]);
      setChatContext(body.updatedContext);
      toolStatus.updateStatus('completed');

      if (recommendationToastTimer) {
        window.clearTimeout(recommendationToastTimer);
      }
      if (recommendationToastId) {
        dismissToast(recommendationToastId);
      }

      const possibleRefund = body as { refundReferenceId?: string };
      if (possibleRefund.refundReferenceId) {
        addToast({
          message: `Refund submitted. Reference ID: ${possibleRefund.refundReferenceId}`,
          variant: 'success',
          durationMs: 7000,
        });
      }
    } catch (error) {
      const nextContext = createFallbackContext(chatContext, message);
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: createMessageId('assistant-fallback'),
          role: 'assistant',
          text: FALLBACK_REPLY,
          createdAt: Date.now(),
          isEscalation: true,
        },
      ]);
      setChatContext(nextContext);
      const errorText = error instanceof Error ? error.message : 'Unable to send message.';
      setErrorMessage(errorText);
      setLastFailedMessage(message);
      toolStatus.fail(errorText);
      addToast({
        message: 'The assistant could not complete that request. Try again?',
        variant: 'error',
        actionLabel: 'Retry',
        onAction: () => {
          void handleSend(message);
        },
        durationMs: 8000,
      });
    } finally {
      if (recommendationToastTimer) {
        window.clearTimeout(recommendationToastTimer);
      }
      setIsSending(false);
      if (refundOrdersToastTimer) {
        window.clearTimeout(refundOrdersToastTimer);
      }
      if (refundSubmitToastTimer) {
        window.clearTimeout(refundSubmitToastTimer);
      }
      if (refundOrdersToastId) {
        dismissToast(refundOrdersToastId);
      }
      if (refundSubmitToastId) {
        dismissToast(refundSubmitToastId);
      }
    }
  }

  if (!shouldRender) {
    return null;
  }

  return (
    <div
      className={`pointer-events-none fixed ${positionClassName} z-30 flex flex-col items-end gap-3 font-sans`}
    >
      <ToastList toasts={toasts} onDismiss={dismissToast} />
      <motion.div
        className={`w-[min(20rem,calc(100vw-1.5rem))] origin-bottom-right overflow-hidden rounded-2xl border border-rose-100 bg-white shadow-2xl ring-1 ring-black/5 sm:w-80 md:w-76 ${
          isOpen ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
        aria-hidden={!isOpen}
        initial={false}
        animate={isOpen ? 'open' : 'closed'}
        variants={panelVariants}
      >
        <div className="relative flex items-start justify-between gap-3 overflow-hidden bg-linear-to-r from-rose-500 via-rose-500 to-pink-500 px-4 py-3 text-white">
          {!shouldReduceMotion ? (
            <span className="pointer-events-none absolute inset-0 opacity-60">
              <span className="absolute inset-0 bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.4),transparent)] animate-[shimmer_2.8s_ease-in-out_infinite]" />
            </span>
          ) : null}
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
          <motion.div
            ref={scrollRef}
            className="chatbot-scrollbar flex-1 space-y-4 overflow-y-auto px-4 py-3"
            aria-live="polite"
            aria-busy={isSending}
            initial={false}
            animate="visible"
          >
            <AnimatePresence initial={false}>
              {messages.map((message) => {
                const isAssistant = message.role === 'assistant';
                const showAvatar = isAssistant;

                return (
                  <motion.div
                    key={message.id}
                    className={`flex items-start gap-3 ${isAssistant ? '' : 'justify-end'}`}
                    variants={messageVariants}
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                    layout="position"
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
                        className={`rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ring-1 transition-transform duration-200 ease-out hover:-translate-y-0.5 ${
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
                      <p
                        className={`px-1 text-[11px] text-slate-400 ${isAssistant ? '' : 'text-right'}`}
                      >
                        {formatRelativeTime(message.createdAt ?? now, now)}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {isSending ? (
              <motion.div
                className="flex items-start gap-3"
                variants={messageVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
              >
                <div className="rounded-2xl rounded-tl-md bg-white px-4 py-3 text-sm text-slate-500 shadow-sm ring-1 ring-slate-100">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="flex items-center gap-1">
                      <span>Typing</span>
                      <span className="flex items-center gap-1">
                        <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
                        <span
                          className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400"
                          style={{ animationDelay: '0.15s' }}
                        />
                        <span
                          className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400"
                          style={{ animationDelay: '0.3s' }}
                        />
                      </span>
                    </span>
                  </span>
                </div>
              </motion.div>
            ) : null}
          </motion.div>

          <div className="border-t border-rose-100 bg-white px-4 py-3">
            {errorMessage ? (
              <div
                className="mb-2 flex items-center justify-between gap-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700"
                aria-live="assertive"
              >
                <span>{errorMessage}</span>
                {lastFailedMessage ? (
                  <button
                    type="button"
                    onClick={() => {
                      void handleSend(lastFailedMessage);
                    }}
                    className="rounded-full border border-rose-200 bg-white px-3 py-1 text-[11px] font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                  >
                    Retry
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 shadow-sm focus-within:border-rose-300 focus-within:ring-2 focus-within:ring-rose-100">
              <input
                ref={inputRef}
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
      </motion.div>

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
