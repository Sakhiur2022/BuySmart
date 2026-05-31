'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Variants } from 'framer-motion';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { Loader2, MessageCircle, Send, Sparkles, X, Paperclip } from 'lucide-react';
import type {
  ChatAPIRequest,
  ChatAPIResponse,
  ChatContext,
  ChatMessage,
  UIMessage,
  ChatbotRole,
} from '@/lib/chatbot/types';
import type { RefundOrderCard } from '@/lib/services/refund-tools/types';
import { useChatToolStatus } from '@/lib/hooks/use-chat-tool-status';
import { useRefundEvidenceAttachment } from '@/lib/hooks/use-refund-evidence-attachment';
import { createClient } from '@/lib/supabase/client';
import { clearChatbotSessionStorage, getChatbotStorageKeys } from '@/lib/chatbot/session';

const DEFAULT_CONTEXT: ChatContext = {
  category: null,
  price_max: null,
  lastOrderId: null,
  history: [],
};

function getGreetingMessage(role: ChatbotRole): UIMessage {
  const greeting =
    role === 'admin'
      ? 'Hello! I can help you navigate the admin dashboard and platform operations.'
      : role === 'seller'
      ? 'Hello! I can help you manage listings, orders, and inventory.'
      : 'Hi there! How can I help you today?';

  return {
    id: 'assistant-greeting',
    role: 'assistant',
    text: greeting,
    createdAt: Date.now(),
  };
}

const FALLBACK_REPLY =
  "I couldn't reach the BuySmart assistant just now. Please try again in a moment, and if this keeps happening we can connect you with support.";

const RECOMMENDATION_TOAST_DELAY_MS = 1800;
const REFUND_ORDER_FETCH_TOAST_DELAY_MS = 2000;
const REFUND_SUBMIT_TOAST_DELAY_MS = 1200;

function createMessageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia(query);

    const updateMatches = () => {
      setMatches(mediaQuery.matches);
    };

    updateMatches();
    mediaQuery.addEventListener('change', updateMatches);

    return () => {
      mediaQuery.removeEventListener('change', updateMatches);
    };
  }, [query]);

  return matches;
}

function ChatWidgetToggle({ isOpen }: { isOpen: boolean }) {
  return (
    <div className="relative flex h-8 w-8 items-center justify-center">
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 30 }}
            transition={{ duration: 0.2, ease: 'circOut' }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <MessageCircle className="h-7 w-7" />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 30 }}
            transition={{ duration: 0.2, ease: 'circOut' }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <X className="h-7 w-7" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
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
  let refundOrderCards: RefundOrderCard[] | undefined;
  if (response.toolCall?.toolName === 'refund_orders_fetch' && response.toolResult) {
    const result = response.toolResult as { orders?: RefundOrderCard[] };
    if (result.orders) {
      refundOrderCards = result.orders;
    }
  }

  return {
    id: createMessageId('assistant'),
    role: 'assistant',
    text: response.reply,
    createdAt: Date.now(),
    products: response.products,
    order: response.order,
    refundOrderCards,
    requiresEvidence: response.intent === 'SUPPORT' || response.toolCall?.toolName === 'refund_request' ? true : undefined,
    policyText: response.policyText,
    isEscalation: response.isEscalation,
  };
}

function buildStreamingAssistantMessage(messageId: string): UIMessage {
  return {
    id: messageId,
    role: 'assistant',
    text: 'Thinking about that now...',
    createdAt: Date.now(),
    status: 'streaming',
  };
}

function buildErrorAssistantMessage(messageId: string, errorText: string): UIMessage {
  return {
    id: messageId,
    role: 'assistant',
    text: FALLBACK_REPLY,
    createdAt: Date.now(),
    status: 'error',
    errorMessage: errorText,
    retryable: true,
    isEscalation: true,
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

function RefundOrderCardItem({ order, onSelect }: { order: RefundOrderCard; onSelect: (orderNumber: string) => void }) {
  return (
    <div className="rounded-xl border border-rose-100 bg-white/80 p-3 text-slate-700 shadow-sm mt-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">Order #{order.order_number || order.order_id.slice(0, 8)}</p>
          <p className="text-xs text-slate-500">Status: <span className="font-medium text-slate-700">{order.status}</span></p>
        </div>
        <p className="text-sm font-semibold text-rose-600">{order.currency} {order.total_amount}</p>
      </div>
      <button 
        onClick={() => onSelect(order.order_number || order.order_id)}
        className="mt-2 w-full rounded bg-rose-50 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 text-center transition"
      >
        Select Order
      </button>
    </div>
  );
}

type ChatbotWidgetProps = {
  chatbotRole?: ChatbotRole;
};

export default function ChatbotWidget({ chatbotRole = 'buyer' }: ChatbotWidgetProps) {
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const storageKeys = useMemo(() => getChatbotStorageKeys(chatbotRole), [chatbotRole]);
  const role = chatbotRole;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const hasInteractedRef = useRef(false);
  const shouldReduceMotion = useReducedMotion();
  const isSmallScreen = useMediaQuery('(max-width: 640px)');
  const [isOpen, setIsOpen] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [draftMessage, setDraftMessage] = useState('');
  const evidenceManager = useRefundEvidenceAttachment();

  const [messages, setMessages] = useState<UIMessage[]>([getGreetingMessage(chatbotRole)]);
  const [chatContext, setChatContext] = useState<ChatContext>(DEFAULT_CONTEXT);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toolStatus = useChatToolStatus();

  const isHiddenRoute = pathname.startsWith('/auth') || pathname.startsWith('/api');

  const shouldRender = !isHiddenRoute;

  const shouldLiftWidget =
    pathname === '/buyer/cart' ||
    pathname === '/buyer/checkout' ||
    pathname === '/buyer/order-confirmation' ||
    pathname.startsWith('/orders/');

  const positionClassName = shouldLiftWidget
    ? 'bottom-20 right-4 md:bottom-24 md:right-8'
    : 'bottom-8 right-4 md:bottom-10 md:right-6';

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

  const mobilePanelVariants: Variants = shouldReduceMotion
    ? {
        open: { opacity: 1 },
        closed: { opacity: 0 },
      }
    : {
        open: {
          opacity: 1,
          scale: 1,
          transition: { duration: 0.24, ease: [0.16, 1, 0.3, 1] },
        },
        closed: {
          opacity: 0,
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

  const resetChatSession = useCallback((nextAuthMarker?: string, preserveOpenState = false) => {
    setMessages([getGreetingMessage(chatbotRole)]);
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
        sessionStorage.setItem(storageKeys.authMarker, nextAuthMarker);
      } catch {
        // Ignore storage failures and keep the widget functional.
      }
    }
  }, [chatbotRole, storageKeys.authMarker]);

  useEffect(() => {
    let isActive = true;

    const hydrateChatState = async () => {
      const authMarker = await getAuthMarker(supabase);
      if (!isActive) {
        return;
      }

      try {
        const storedOpenState = sessionStorage.getItem(storageKeys.open);
        const storedMessages = sessionStorage.getItem(storageKeys.messages);
        const storedContext = sessionStorage.getItem(storageKeys.context);
        const storedAuthMarker = sessionStorage.getItem(storageKeys.authMarker);

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

          sessionStorage.setItem(storageKeys.authMarker, authMarker);
        }
      } catch {
        setIsOpen(false);
        setMessages([getGreetingMessage(chatbotRole)]);
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
  }, [chatbotRole, resetChatSession, storageKeys.authMarker, storageKeys.context, storageKeys.messages, storageKeys.open, supabase]);

  useEffect(() => {
    if (!hasLoaded) {
      return;
    }

    try {
      sessionStorage.setItem(storageKeys.open, String(isOpen));
      sessionStorage.setItem(storageKeys.messages, JSON.stringify(messages));
      sessionStorage.setItem(storageKeys.context, JSON.stringify(chatContext));
    } catch {
      // Ignore storage failures and keep the widget functional.
    }
  }, [chatContext, hasLoaded, isOpen, messages, storageKeys.context, storageKeys.messages, storageKeys.open]);

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
  }, [resetChatSession, supabase]);

  useEffect(() => {
    setNow(Date.now());
  }, []);

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
    let message = (overrideMessage ?? draftMessage).trim();
    if (!message && evidenceManager.file) {
      message = 'Attached evidence.';
    }
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
      role,
      evidenceImages: evidenceManager.file ? [URL.createObjectURL(evidenceManager.file)] : undefined
    };

    if (evidenceManager.file) {
      userMessage.text += '\n[Photo attached]';
      evidenceManager.remove();
    }

    const assistantMessageId = createMessageId('assistant-stream');
    const assistantPlaceholder = buildStreamingAssistantMessage(assistantMessageId);

    setMessages((currentMessages) => [...currentMessages, userMessage, assistantPlaceholder]);
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
      const endpoint =
        role === 'seller'
          ? '/api/seller/chat'
          : role === 'admin'
          ? '/api/admin/chat'
          : '/api/buyer/chat';
      const response = await fetch(endpoint, {
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

      setMessages((currentMessages) =>
        currentMessages.map((currentMessage) =>
          currentMessage.id === assistantMessageId ? buildAssistantMessage(body) : currentMessage,
        ),
      );
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
      const errorText = error instanceof Error ? error.message : 'Unable to send message.';
      setMessages((currentMessages) =>
        currentMessages.map((currentMessage) =>
          currentMessage.id === assistantMessageId
            ? buildErrorAssistantMessage(assistantMessageId, errorText)
            : currentMessage,
        ),
      );
      setChatContext(nextContext);
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
    <>
      {isSmallScreen && isOpen ? (
        <button
          type="button"
          aria-label="Close chat backdrop"
          data-testid="buyer-chatbot-backdrop"
          className="fixed inset-0 z-[190] cursor-default bg-slate-950/35 backdrop-blur-[2px]"
          onClick={() => {
            hasInteractedRef.current = true;
            setIsOpen(false);
          }}
        />
      ) : null}

      <div
        className={`pointer-events-none fixed ${isSmallScreen && isOpen ? 'inset-0 z-[200] p-2 sm:p-4' : `${positionClassName} z-[200]`} flex flex-col items-end justify-end gap-3 font-sans`}
      >
        <ToastList toasts={toasts} onDismiss={dismissToast} />
        <motion.div
          data-testid="buyer-chatbot-panel"
          className={`flex min-h-0 flex-col overflow-hidden border border-rose-100 bg-rose-50/95 shadow-[0_24px_70px_rgba(15,23,42,0.16),inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-xl ${
            isSmallScreen && isOpen
              ? 'pointer-events-auto h-[calc(100dvh-1rem)] w-full rounded-[1.75rem] sm:h-[calc(100dvh-2rem)] sm:max-w-md sm:self-end sm:rounded-3xl'
              : `pointer-events-auto h-[28rem] w-[min(20rem,calc(100vw-1.5rem))] origin-bottom-right rounded-2xl sm:w-80 md:w-76 ${
                  isOpen ? 'pointer-events-auto' : 'pointer-events-none'
                }`
          }`}
          aria-hidden={!isOpen}
          initial={false}
          animate={isOpen ? 'open' : 'closed'}
          variants={isSmallScreen ? mobilePanelVariants : panelVariants}
        >
          <div className="relative flex items-start justify-between gap-3 overflow-hidden bg-rose-50 px-4 py-3 text-slate-800 shadow-[inset_0_-1px_0_rgba(15,23,42,0.04)]">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-rose-500/80">
                <Sparkles className="h-4 w-4" />
                Support
              </div>
              <h2 className="text-lg font-semibold leading-none text-slate-900">Chat with us</h2>
              <p className="text-xs text-slate-500 sm:text-sm">
                BuySmart assistant - typically replies in minutes
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                hasInteractedRef.current = true;
                setIsOpen(false);
              }}
              onMouseDown={() => {
                hasInteractedRef.current = true;
              }}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-rose-100 bg-white text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)] transition hover:-translate-y-0.5 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200"
              aria-label="Close chat"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.72),rgba(255,241,242,0.5))]">
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
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/80 bg-white text-rose-600 shadow-[0_10px_25px_rgba(244,63,94,0.12),inset_0_1px_0_rgba(255,255,255,0.95)]">
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
                          className={`rounded-2xl px-4 py-3 text-sm leading-6 shadow-[0_10px_24px_rgba(15,23,42,0.08)] transition-transform duration-200 ease-out hover:-translate-y-0.5 ${
                            isAssistant
                              ? 'rounded-tl-md border border-white/80 bg-white/90 text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.95)]'
                              : 'rounded-tr-md border border-rose-300/40 bg-rose-500 text-white shadow-[0_10px_24px_rgba(244,63,94,0.16),inset_0_1px_0_rgba(255,255,255,0.18)]'
                          }`}
                        >
                          {message.status === 'streaming' ? (
                            <div className="flex items-center gap-2 text-slate-500">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>{message.text}</span>
                            </div>
                          ) : (
                            <p>{message.text}</p>
                          )}

                          {message.status === 'error' ? (
                            <div className="mt-3 space-y-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-rose-700">
                              <p className="text-xs font-medium">
                                {message.errorMessage ?? 'Unable to complete this message.'}
                              </p>
                              {message.retryable && lastFailedMessage ? (
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

                          {message.products && message.products.length > 0 ? (
                            <div className="mt-3 space-y-2">
                              {message.products.map((product) => (
                                <div
                                  key={product.id}
                                  className="rounded-xl border border-rose-100 bg-white/80 px-3 py-2 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
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

                          {message.refundOrderCards && message.refundOrderCards.length > 0 ? (
                            <div className="mt-3 space-y-2">
                              {message.refundOrderCards.map((order) => (
                                <RefundOrderCardItem 
                                  key={order.order_id} 
                                  order={order} 
                                  onSelect={(selectedOrderNumber) => handleSend(`Selected order: ${selectedOrderNumber}`)} 
                                />
                              ))}
                            </div>
                          ) : null}

                          {message.policyText ? (
                            <div className="mt-3 whitespace-pre-line rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                              {message.policyText}
                            </div>
                          ) : null}

                          {message.isEscalation ? (
                            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
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
            </motion.div>

            <div className="border-t border-rose-100/80 bg-white/85 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
              {errorMessage ? (
                <div
                  className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700"
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

              {evidenceManager.file && (
                <div className="flex items-center gap-2 mb-2 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-800">
                  <Paperclip className="h-3 w-3" />
                  <span className="flex-1 truncate">{evidenceManager.file.name}</span>
                  <button type="button" onClick={() => evidenceManager.remove()} className="hover:text-rose-900">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              {evidenceManager.validation && !evidenceManager.validation.valid && (
                <div className="mb-2 text-[11px] text-red-500">{evidenceManager.validation.reason}</div>
              )}

              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-[0_10px_24px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.95)] focus-within:border-rose-200 focus-within:ring-2 focus-within:ring-rose-100">
                <label className="cursor-pointer text-slate-400 hover:text-slate-600">
                  <Paperclip className="h-4 w-4" />
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        evidenceManager.attach(e.target.files[0]);
                      }
                    }} 
                  />
                </label>
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
                  disabled={isSending || (!draftMessage.trim() && !evidenceManager.file)}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white shadow-[0_10px_20px_rgba(244,63,94,0.18),inset_0_1px_0_rgba(255,255,255,0.25)] transition-transform hover:-translate-y-0.5 hover:bg-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200 disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-rose-300"
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
            className={`flex h-14 w-14 items-center justify-center rounded-full bg-rose-500 text-white transition-transform duration-300 hover:scale-105 hover:bg-rose-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-200 ${
              hasLoaded && !isOpen ? 'animate-[bounce_1.4s_ease-in-out_1]' : ''
            }`}
            aria-expanded={isOpen}
            aria-label={isOpen ? 'Close chat' : 'Open chat'}
          >
            <ChatWidgetToggle isOpen={isOpen} />
          </button>
        </div>
      </div>
    </>
  );
}
