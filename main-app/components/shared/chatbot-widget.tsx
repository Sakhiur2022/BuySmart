'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Variants } from 'framer-motion';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import {
  Loader2,
  MessageCircle,
  Send,
  Sparkles,
  X,
  Paperclip,
  Zap,
  Square,
  CheckCircle2,
  ReceiptText,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import type {
  ChatAPIRequest,
  ChatAPIResponse,
  ChatContext,
  ChatMessage,
  UIMessage,
  ChatbotRole,
} from '@/lib/chatbot/types';
import {
  buildRefundTimeoutReply,
  isRefundRelatedMessage,
  REFUND_MANUAL_REQUEST_GUIDED_ROUTE,
} from '@/lib/chatbot/refund-fallback';
import type { RefundOrderCard } from '@/lib/services/refund-tools/types';
import { SellerListingPreviewCard } from '@/components/shared/seller-listing-preview-card';
import {
  buildSellerListingIntentOutput,
  createEmptySellerListingDraft,
  extractSellerListingDraft,
  getSellerListingMissingFields,
  getSellerListingPrompt,
  isSellerListingCancelMessage,
  isSellerListingStartMessage,
  isSellerListingSubmitMessage,
  type SellerListingDraft,
} from '@/lib/chatbot/seller-listing-draft';
import {
  buildSellerSalesSummaryIntentOutput,
  buildSellerSalesSummaryPreview,
  isApproveAllRefundsCommand,
  isSellerSalesSummaryRequest,
} from '@/lib/chatbot/seller-chat-commands';
import { useChatToolStatus } from '@/lib/hooks/use-chat-tool-status';
import { useRefundEvidenceAttachment } from '@/lib/hooks/use-refund-evidence-attachment';
import { useChatMode } from '@/lib/hooks/use-chat-mode';
import { createClient } from '@/lib/supabase/client';
import { clearChatbotSessionStorage, getChatbotStorageKeys } from '@/lib/chatbot/session';
import { SellerSalesSummaryCard } from '@/components/shared/seller-sales-summary-card';
import { useSellerCategories } from '@/lib/hooks/use-seller-categories';

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
const LOCAL_CHAT_REQUEST_TIMEOUT_MS = 1500;
const PROD_CHAT_REQUEST_TIMEOUT_MS = 20000;
const LOCAL_CHAT_TIMEOUT_STORAGE_KEY = 'buysmart-chat-fast-timeout';

function isLocalhostHost(hostname: string) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.endsWith('.localhost')
  );
}

// Use the fast timeout on localhost for a nicer dev loop, but keep the production
// timeout everywhere else, including deployed preview and real app hosts.
function getChatRequestTimeoutMs(useLocalTimeout: boolean) {
  return process.env.NODE_ENV === 'development' && !process.env.VITEST
    ? useLocalTimeout
      ? LOCAL_CHAT_REQUEST_TIMEOUT_MS
      : PROD_CHAT_REQUEST_TIMEOUT_MS
    : PROD_CHAT_REQUEST_TIMEOUT_MS;
}

const PAUSED_REPLY_MESSAGE = 'Reply paused. You can send another message now.';

function createMessageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function scrollElementToBottom(element: HTMLDivElement | null) {
  if (!element) {
    return;
  }

  if (typeof element.scrollTo === 'function') {
    element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
    return;
  }

  element.scrollTop = element.scrollHeight;
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

type GuidanceKind = 'refund';

type GuidanceState = {
  kind: GuidanceKind;
  message: string;
};

function RefundGuidanceCard({
  message,
  onOpenOrders,
  onDismiss,
}: {
  message: string;
  onOpenOrders: () => void;
  onDismiss: () => void;
}) {
  const steps = [
    'Open Orders',
    'Select the order you want refunded',
    'Add photos or comments, then submit the refund',
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.98 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="chatbot-scrollbar mb-3 max-h-[min(18rem,calc(100dvh-12rem))] overflow-y-auto rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 via-white to-orange-50 px-4 py-4 pr-2 shadow-[0_16px_30px_rgba(244,63,94,0.08)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white shadow-[0_10px_24px_rgba(244,63,94,0.25)]">
            <ReceiptText className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-500/80">
              Refund guidance
            </p>
            <h3 className="text-sm font-semibold text-slate-900">
              We can start the refund flow now
            </h3>
            <p className="text-xs leading-5 text-slate-600">
              {message} I&apos;ll keep guiding you step by step until it&apos;s submitted.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="rounded-full px-2 py-1 text-[11px] font-semibold text-slate-500 transition hover:bg-white hover:text-slate-700"
        >
          Dismiss
        </button>
      </div>

      <div className="mt-4 grid gap-2">
        {steps.map((step, index) => (
          <div
            key={step}
            className="flex items-center gap-3 rounded-xl border border-white/80 bg-white/75 px-3 py-2 text-xs text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-100 text-[11px] font-bold text-rose-700">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1">{step}</span>
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onOpenOrders}
          className="inline-flex items-center justify-center rounded-full bg-rose-500 px-4 py-2 text-xs font-semibold text-white shadow-[0_10px_20px_rgba(244,63,94,0.18)] transition hover:-translate-y-0.5 hover:bg-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200"
        >
          Open Orders and start refund
        </button>
        <p className="text-[11px] text-slate-500">
          We can continue from the order details page whenever you&apos;re ready.
        </p>
      </div>
    </motion.div>
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
    (typeof candidate.status === 'undefined' ||
      candidate.status === 'streaming' ||
      candidate.status === 'error' ||
      candidate.status === 'timeout') &&
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

function formatOrderDate(isoDate: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown date';
  }

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
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

  let sellerListingPreview: UIMessage['sellerListingPreview'];
  if (response.toolCall?.toolName === 'seller_listing_create' && response.toolResult) {
    const result = response.toolResult as {
      success?: boolean;
      listing?: {
        name: string;
        price: number;
        category: string;
        photos: string[];
        stockQuantity: number;
      };
    };

    if (result.listing) {
      sellerListingPreview = {
        name: result.listing.name,
        price: result.listing.price,
        category: result.listing.category,
        stockQuantity: result.listing.stockQuantity,
        photos: result.listing.photos,
        missingFields: [],
        status: 'created',
      };
    }
  }

  let sellerSalesSummaryPreview: UIMessage['sellerSalesSummaryPreview'];
  if (response.toolCall?.toolName === 'seller_sales_summary' && response.toolResult) {
    const result = response.toolResult as {
      totalItemsSold?: number;
      totalRevenue?: number;
      topProduct?: { product_id: string; name?: string | null; itemsSold: number } | null;
      pendingRefundCount?: number;
    };

    if (typeof result.totalItemsSold === 'number' && typeof result.totalRevenue === 'number') {
      sellerSalesSummaryPreview = buildSellerSalesSummaryPreview({
        totalItemsSold: result.totalItemsSold,
        totalRevenue: result.totalRevenue,
        topProduct: result.topProduct,
        pendingRefundCount: result.pendingRefundCount,
      });
    }
  }

  const responseDetails: string[] = [];
  if (response.refundReferenceId) {
    responseDetails.push(`Refund reference: ${response.refundReferenceId}`);
  }
  if (response.toolCall?.toolName === 'refund_request' && response.toolError) {
    responseDetails.push(getRefundErrorMessage(response.toolError.code));
  }

  if (sellerSalesSummaryPreview) {
    responseDetails.unshift(
      `This week: ${sellerSalesSummaryPreview.totalItemsSold} items sold, ${formatCurrency(sellerSalesSummaryPreview.totalRevenue)} revenue, ${sellerSalesSummaryPreview.pendingRefundCount} pending refunds.`,
    );
  }

  const replyText =
    responseDetails.length > 0
      ? `${response.reply}\n${responseDetails.join('\n')}`
      : response.reply;

  return {
    id: createMessageId('assistant'),
    role: 'assistant',
    text: replyText,
    createdAt: Date.now(),
    products: response.products,
    order: response.order,
    refundOrderCards,
    sellerListingPreview,
    sellerSalesSummaryPreview,
    requiresEvidence:
      response.intent === 'SUPPORT' || response.toolCall?.toolName === 'refund_request'
        ? true
        : undefined,
    policyText: response.policyText,
    isEscalation: response.isEscalation,
  };
}

function buildSellerListingPreview(
  draft: SellerListingDraft,
  status: 'draft' | 'ready' | 'created' = 'draft',
) {
  return {
    name: draft.name.trim(),
    price: draft.price,
    category: draft.category.trim(),
    stockQuantity: draft.stockQuantity,
    photos: [...draft.photos],
    missingFields: getSellerListingMissingFields(draft),
    status,
  };
}

function buildSellerListingAssistantMessage(
  message: string,
  draft: SellerListingDraft,
  status: 'draft' | 'ready' | 'created' = 'draft',
): UIMessage {
  return {
    id: createMessageId('assistant'),
    role: 'assistant',
    text: message,
    createdAt: Date.now(),
    sellerListingPreview: buildSellerListingPreview(draft, status),
  };
}

function buildSellerSalesSummaryAssistantMessage(
  message: string,
  preview: NonNullable<UIMessage['sellerSalesSummaryPreview']>,
): UIMessage {
  return {
    id: createMessageId('assistant'),
    role: 'assistant',
    text: message,
    createdAt: Date.now(),
    sellerSalesSummaryPreview: preview,
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

function buildPausedAssistantMessage(messageId: string): UIMessage {
  return {
    id: messageId,
    role: 'assistant',
    text: 'Reply paused.',
    createdAt: Date.now(),
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

function buildTimeoutAssistantMessage(
  messageId: string,
  replyText: string,
  errorText: string,
): UIMessage {
  return {
    ...buildErrorAssistantMessage(messageId, errorText),
    text: replyText,
    status: 'timeout',
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

function RefundOrderCardItem({
  order,
  isSelected,
  onSelect,
}: {
  order: RefundOrderCard;
  isSelected: boolean;
  onSelect: (order: RefundOrderCard) => void;
}) {
  return (
    <div className="w-full overflow-hidden rounded-xl border border-rose-100 bg-white/90 p-3 text-slate-700 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="relative h-12 w-12 overflow-hidden rounded-lg border border-rose-100 bg-rose-50">
          {order.thumbnail_url ? (
            <Image
              src={order.thumbnail_url}
              alt={order.product_name ?? 'Order item'}
              fill
              sizes="48px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-rose-400">
              No image
            </div>
          )}
        </div>
        <div className="flex-1 space-y-1">
          <p className="text-sm font-semibold text-slate-900">
            {order.product_name ?? 'Order items'}
          </p>
          <p className="text-xs text-slate-500">
            Order #{order.order_number || order.order_id.slice(0, 8)}
          </p>
          <p className="text-xs text-slate-500">Placed {formatOrderDate(order.created_at)}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-rose-600">
            {order.currency} {order.total_amount}
          </p>
          <p className="text-[11px] font-medium text-slate-500">{order.status}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onSelect(order)}
        disabled={isSelected}
        className={`mt-3 w-full rounded-full py-1.5 text-xs font-semibold transition ${
          isSelected
            ? 'cursor-default bg-emerald-50 text-emerald-700'
            : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
        }`}
      >
        {isSelected ? 'Selected' : 'Select order'}
      </button>
    </div>
  );
}

type ChatbotWidgetProps = {
  chatbotRole?: ChatbotRole;
};

export default function ChatbotWidget({ chatbotRole = 'buyer' }: ChatbotWidgetProps) {
  const pathname = usePathname();
  const { categories: validCategories } = useSellerCategories();
  const supabase = useMemo(() => createClient(), []);
  const storageKeys = useMemo(() => getChatbotStorageKeys(chatbotRole), [chatbotRole]);
  const role = chatbotRole;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const hasInteractedRef = useRef(false);
  const shouldReduceMotion = useReducedMotion();
  const isSmallScreen = useMediaQuery('(max-width: 640px)');
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [draftMessage, setDraftMessage] = useState('');
  const evidenceManager = useRefundEvidenceAttachment();
  const [selectedOrder, setSelectedOrder] = useState<RefundOrderCard | null>(null);
  const [refundComments, setRefundComments] = useState('');
  const [refundError, setRefundError] = useState<string | null>(null);
  const [isRefundSubmitting, setIsRefundSubmitting] = useState(false);
  const [isRefundUploading, setIsRefundUploading] = useState(false);
  const [evidencePreviews, setEvidencePreviews] = useState<Array<{ url: string; name: string }>>(
    [],
  );
  const [sellerListingDraft, setSellerListingDraft] = useState<SellerListingDraft | null>(null);
  const [sellerSalesSummary, setSellerSalesSummary] = useState<{
    timeframeLabel: string;
    totalItemsSold: number;
    totalRevenue: number;
    topProduct: { name: string; itemsSold: number } | null;
    pendingRefundCount: number;
  } | null>(null);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [isSellerAuthLoaded, setIsSellerAuthLoaded] = useState(false);
  const refundPromptedOrderRef = useRef<string | null>(null);

  const [messages, setMessages] = useState<UIMessage[]>([getGreetingMessage(chatbotRole)]);
  const [chatContext, setChatContext] = useState<ChatContext>(DEFAULT_CONTEXT);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const [activeGuidance, setActiveGuidance] = useState<GuidanceState | null>(null);
  const [pausedReplyText, setPausedReplyText] = useState<string | null>(null);
  const chatMode = useChatMode(role);
  const [isLocalhost, setIsLocalhost] = useState(false);
  const [useLocalTimeout, setUseLocalTimeout] = useState(true);
  const closeChat = useCallback(() => {
    setIsOpen(false);
    setIsFullscreen(false);
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const localHost =
      process.env.NODE_ENV === 'development' &&
      !process.env.VITEST &&
      isLocalhostHost(window.location.hostname);
    setIsLocalhost(localHost);

    if (!localHost) {
      return;
    }

    try {
      const storedValue = window.localStorage.getItem(LOCAL_CHAT_TIMEOUT_STORAGE_KEY);
      if (storedValue !== null) {
        setUseLocalTimeout(storedValue === '1');
      }
    } catch {
      setUseLocalTimeout(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !isLocalhost) {
      return;
    }

    try {
      window.localStorage.setItem(LOCAL_CHAT_TIMEOUT_STORAGE_KEY, useLocalTimeout ? '1' : '0');
    } catch {
      // Ignore storage failures in private browsing or hardened environments.
    }
  }, [isLocalhost, useLocalTimeout]);
  useEffect(() => {
    const handler = () => {
      hasInteractedRef.current = true;
      setShouldAutoScroll(true);
      setIsOpen(true);
    };

    window.addEventListener('buysmart:seller-open-chat', handler as EventListener);
    return () => {
      window.removeEventListener('buysmart:seller-open-chat', handler as EventListener);
    };
  }, []);

  useEffect(() => {
    if (role !== 'seller') {
      setSellerId(null);
      setIsSellerAuthLoaded(true);
      return;
    }

    setIsSellerAuthLoaded(false);
    let isActive = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (!isActive) {
        return;
      }

      setSellerId(data.user?.id ?? null);
      setIsSellerAuthLoaded(true);
    });

    return () => {
      isActive = false;
    };
  }, [role, supabase]);
  const CHAT_REQUEST_TIMEOUT_MS = getChatRequestTimeoutMs(useLocalTimeout);
  const CHAT_REQUEST_TIMEOUT_SECONDS = CHAT_REQUEST_TIMEOUT_MS / 1000;
  const [now, setNow] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [sessionGeneration, setSessionGeneration] = useState(0);
  const prevMessagesLenRef = useRef<number>(messages.length);
  const toolStatus = useChatToolStatus();
  const sessionVersionRef = useRef(0);
  const activeRequestControllerRef = useRef<AbortController | null>(null);
  const activeRequestIdRef = useRef(0);
  const activeRequestTimeoutIdRef = useRef<number | null>(null);
  const activeRequestMessageIdRef = useRef<string | null>(null);
  const activeRequestFinalizedRef = useRef(false);
  const activeRequestAbortReasonRef = useRef<'timeout' | 'manual' | null>(null);

  const isHiddenRoute = pathname.startsWith('/auth') || pathname.startsWith('/api');

  const shouldRender = !isHiddenRoute;

  const shouldLiftWidget =
    pathname === '/buyer/cart' ||
    pathname === '/buyer/checkout' ||
    pathname === '/buyer/order-confirmation' ||
    pathname.startsWith('/orders/');
  const shouldRestoreOpenState = !shouldLiftWidget;
  const isMobileOverlayOpen = isSmallScreen && isOpen;
  const isDesktopFullscreen = isOpen && isFullscreen && !isSmallScreen;
  const isFullscreenLayout = isMobileOverlayOpen || isDesktopFullscreen;

  const positionClassName = shouldLiftWidget
    ? 'bottom-20 right-4 md:bottom-24 md:right-8'
    : 'bottom-8 right-4 md:bottom-10 md:right-6';

  const addToast = useCallback((toast: Omit<Toast, 'id'> & { durationMs?: number }) => {
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
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

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

  const resetChatSession = useCallback(
    (nextAuthMarker?: string, preserveOpenState = false) => {
      activeRequestControllerRef.current?.abort();
      activeRequestControllerRef.current = null;
      activeRequestTimeoutIdRef.current = null;
      activeRequestMessageIdRef.current = null;
      activeRequestFinalizedRef.current = false;
      activeRequestAbortReasonRef.current = null;
      sessionVersionRef.current += 1;
      setSessionGeneration((current) => current + 1);
      setMessages([getGreetingMessage(chatbotRole)]);
      setChatContext(DEFAULT_CONTEXT);
      setDraftMessage('');
      setErrorMessage(null);
      setActiveGuidance(null);
      setPausedReplyText(null);
      setIsSending(false);
      setSelectedOrder(null);
      setRefundComments('');
      setRefundError(null);
      setSellerListingDraft(null);
      setSellerSalesSummary(null);
      evidenceManager.clear();
      chatMode.reset();
      if (!preserveOpenState) {
        closeChat();
      }
      clearChatbotSessionStorage();

      if (nextAuthMarker) {
        try {
          sessionStorage.setItem(storageKeys.authMarker, nextAuthMarker);
        } catch {
          // Ignore storage failures and keep the widget functional.
        }
      }
    },
    [chatbotRole, evidenceManager, storageKeys.authMarker, chatMode, closeChat],
  );

  useEffect(() => {
    let isActive = true;
    const hydrationVersion = sessionVersionRef.current;

    const hydrateChatState = async () => {
      const authMarker = await getAuthMarker(supabase);
      if (!isActive) {
        return;
      }

      if (hydrationVersion !== sessionVersionRef.current) {
        return;
      }

      try {
        const storedMessages = sessionStorage.getItem(storageKeys.messages);
        const storedContext = sessionStorage.getItem(storageKeys.context);
        const storedAuthMarker = sessionStorage.getItem(storageKeys.authMarker);

        if (storedAuthMarker && storedAuthMarker !== authMarker) {
          resetChatSession(authMarker, hasInteractedRef.current);
        } else {
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
        closeChat();
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
  }, [
    chatbotRole,
    closeChat,
    shouldRestoreOpenState,
    resetChatSession,
    storageKeys.authMarker,
    storageKeys.context,
    storageKeys.messages,
    storageKeys.open,
    supabase,
  ]);

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
  }, [
    chatContext,
    hasLoaded,
    isOpen,
    messages,
    storageKeys.context,
    storageKeys.messages,
    storageKeys.open,
  ]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        const authMarker = session?.user?.id ? `user:${session.user.id}` : 'guest';
        resetChatSession(authMarker, true);
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
    if (evidenceManager.files.length === 0) {
      setEvidencePreviews([]);
      return;
    }

    const previews = evidenceManager.files.map((file) => ({
      name: file.name,
      url: URL.createObjectURL(file),
    }));
    setEvidencePreviews(previews);

    // After attaching images, ensure the refund form (and submit button)
    // is scrolled into view so the user can submit.
    setShouldAutoScroll(true);
    setTimeout(() => {
      scrollElementToBottom(scrollRef.current);
    }, 120);

    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [evidenceManager.files]);

  useEffect(() => {
    if (!isOpen) return;

    // Only auto-scroll when new messages were appended and the user
    // was at (or near) the bottom. This prevents layout changes
    // (like opening the refund UI) from forcing the view down.
    const prevLen = prevMessagesLenRef.current ?? 0;
    const curLen = messages.length;
    const appended = curLen > prevLen;

    prevMessagesLenRef.current = curLen;

    if (!appended || !shouldAutoScroll) return;

    scrollElementToBottom(scrollRef.current);
  }, [isOpen, isSending, messages, shouldAutoScroll]);

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
    return () => {
      activeRequestControllerRef.current?.abort();
    };
  }, []);

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
        closeChat();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, closeChat]);

  const pushAssistantMessage = useCallback((text: string) => {
    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: createMessageId('assistant'),
        role: 'assistant',
        text,
        createdAt: Date.now(),
      },
    ]);
  }, []);

  const handleOrderSelect = useCallback(
    (order: RefundOrderCard) => {
      setSelectedOrder(order);
      setRefundComments('');
      setRefundError(null);
      setSellerListingDraft(null);
      evidenceManager.clear();

      if (refundPromptedOrderRef.current !== order.order_id) {
        pushAssistantMessage(
          'Thanks! Please upload photos of the issue and add any optional comments before submitting your refund request.',
        );
        refundPromptedOrderRef.current = order.order_id;
      }

      // Ensure the refund card is visible after selection: enable auto-scroll
      // and scroll to the bottom of the messages container.
      setShouldAutoScroll(true);
      setTimeout(() => {
        scrollElementToBottom(scrollRef.current);
      }, 120);
    },
    [evidenceManager, pushAssistantMessage],
  );

  const uploadRefundEvidence = useCallback(async (files: File[], orderId: string) => {
    if (files.length === 0) {
      return [] as string[];
    }

    const formData = new FormData();
    formData.append('orderId', orderId);
    files.forEach((file) => {
      formData.append('files', file, file.name);
    });

    const response = await fetch('/api/buyer/refund-evidence', {
      method: 'POST',
      body: formData,
    });

    const body = (await response.json().catch(() => null)) as {
      urls?: string[];
      error?: string;
    } | null;

    if (!response.ok || !body?.urls) {
      const message = body?.error || 'Failed to upload evidence.';
      throw new Error(message);
    }

    return body.urls;
  }, []);

  const stopActiveRequest = useCallback(() => {
    const controller = activeRequestControllerRef.current;
    const assistantMessageId = activeRequestMessageIdRef.current;
    if (!controller || controller.signal.aborted) {
      return;
    }

    activeRequestAbortReasonRef.current = 'manual';

    if (assistantMessageId) {
      setMessages((currentMessages) =>
        currentMessages.map((currentMessage) =>
          currentMessage.id === assistantMessageId
            ? buildPausedAssistantMessage(assistantMessageId)
            : currentMessage,
        ),
      );
    }

    // Invalidate the in-flight request so any late resolution cannot overwrite
    // the paused state or re-open the spinner.
    activeRequestIdRef.current += 1;
    activeRequestFinalizedRef.current = true;
    if (activeRequestTimeoutIdRef.current !== null) {
      window.clearTimeout(activeRequestTimeoutIdRef.current);
      activeRequestTimeoutIdRef.current = null;
    }

    controller.abort();
    activeRequestControllerRef.current = null;
    activeRequestMessageIdRef.current = null;
    setIsSending(false);
    setErrorMessage(null);
    setLastFailedMessage(null);
    setActiveGuidance(null);
    setPausedReplyText(PAUSED_REPLY_MESSAGE);
    toolStatus.reset();
  }, [toolStatus]);

  const handleSend = useCallback(
    async (
      overrideMessage?: string,
      options?: { intentOutput?: unknown; evidenceImages?: string[] },
    ) => {
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

      let effectiveIntentOutput = options?.intentOutput;
      if (role === 'seller' && chatMode.isAgentic && !effectiveIntentOutput) {
        if (isApproveAllRefundsCommand(message)) {
          const currentSummary = sellerSalesSummary;
          const approvedCount = currentSummary?.pendingRefundCount ?? 0;

          setMessages((currentMessages) => {
            const assistantMessage: UIMessage = currentSummary
              ? buildSellerSalesSummaryAssistantMessage(
                  approvedCount > 0
                    ? `Approved ${approvedCount} pending refunds in chat.`
                    : 'There are no pending refunds to approve right now.',
                  {
                    ...currentSummary,
                    pendingRefundCount: 0,
                  },
                )
              : {
                  id: createMessageId('assistant'),
                  role: 'assistant',
                  text: "Ask me for this week's sales summary first so I can review pending refunds here.",
                  createdAt: Date.now(),
                };

            return [...currentMessages, userMessage, assistantMessage];
          });

          if (currentSummary) {
            setSellerSalesSummary({
              ...currentSummary,
              pendingRefundCount: 0,
            });
          }

          setDraftMessage('');
          setErrorMessage(null);
          setLastFailedMessage(null);
          setActiveGuidance(null);
          setPausedReplyText(null);
          setIsSending(false);
          toolStatus.updateStatus('completed');

          addToast({
            message:
              approvedCount > 0
                ? `Approved ${approvedCount} pending refunds.`
                : 'No pending refunds to approve right now.',
            variant: 'success',
            durationMs: 3000,
          });

          return null;
        }

        if (isSellerSalesSummaryRequest(message)) {
          if (!isSellerAuthLoaded) {
            setMessages((currentMessages) => [
              ...currentMessages,
              userMessage,
              {
                id: createMessageId('assistant'),
                role: 'assistant',
                text: 'Loading your seller account. Try that again in a moment.',
                createdAt: Date.now(),
              },
            ]);
            setDraftMessage('');
            setErrorMessage(null);
            setLastFailedMessage(null);
            setActiveGuidance(null);
            setPausedReplyText(null);
            setIsSending(false);
            toolStatus.updateStatus('completed');
            return null;
          }

          if (!sellerId) {
            setMessages((currentMessages) => [
              ...currentMessages,
              userMessage,
              {
                id: createMessageId('assistant'),
                role: 'assistant',
                text: "Please sign in to your seller account so I can load this week's sales summary.",
                createdAt: Date.now(),
              },
            ]);
            setDraftMessage('');
            setErrorMessage(null);
            setLastFailedMessage(null);
            setActiveGuidance(null);
            setPausedReplyText(null);
            setIsSending(false);
            toolStatus.updateStatus('completed');
            return null;
          }

          effectiveIntentOutput = buildSellerSalesSummaryIntentOutput(sellerId);
        }

        // ==================== SELLER LISTING LOGIC (v2 - Better parsing) ====================
        const isListingConversation =
          sellerListingDraft !== null || isSellerListingStartMessage(message);

        if (isSellerListingSubmitMessage(message) && sellerListingDraft) {
          const nextDraft = extractSellerListingDraft(
            message,
            sellerListingDraft ?? createEmptySellerListingDraft(),
            validCategories,
          );
          const missingFields = getSellerListingMissingFields(nextDraft);

          if (missingFields.length === 0 && sellerId) {
            effectiveIntentOutput = buildSellerListingIntentOutput(nextDraft, sellerId);
          }
        }

        if (isSellerListingCancelMessage(message) && sellerListingDraft) {
          setMessages((currentMessages) => [
            ...currentMessages,
            userMessage,
            buildSellerListingAssistantMessage(
              'Draft cleared. Say "Add a new product" when you want to start again.',
              createEmptySellerListingDraft(),
            ),
          ]);
          setSellerListingDraft(null);
          setDraftMessage('');
          setErrorMessage(null);
          setLastFailedMessage(null);
          setActiveGuidance(null);
          setPausedReplyText(null);
          setIsSending(false);
          toolStatus.updateStatus('completed');
          return null;
        }

        if (isListingConversation && !effectiveIntentOutput) {
          let nextDraft: SellerListingDraft;
          let replyText = '';

          if (sellerListingDraft === null) {
            // Start new listing
            nextDraft = createEmptySellerListingDraft();
            replyText = "Great! Let's create a new product.\n\nWhat is the product **name**?";
          } else {
            // Update draft with user's latest message
            nextDraft = extractSellerListingDraft(message, sellerListingDraft);

            const missingFields = getSellerListingMissingFields(nextDraft);

            if (missingFields.length === 0) {
              replyText =
                "Great! Everything looks ready. Review the preview and tap 'Create listing'.";
            } else {
              replyText =
                getSellerListingPrompt(nextDraft, validCategories) ||
                `Still missing: ${missingFields.join(', ')}. Please provide them.`;
            }
          }

          const isReady = getSellerListingMissingFields(nextDraft).length === 0;

          setSellerListingDraft(nextDraft);
          setMessages((currentMessages) => [
            ...currentMessages,
            userMessage,
            buildSellerListingAssistantMessage(replyText, nextDraft, isReady ? 'ready' : 'draft'),
          ]);

          setDraftMessage('');
          setErrorMessage(null);
          setLastFailedMessage(null);
          setActiveGuidance(null);
          setPausedReplyText(null);
          setIsSending(false);
          toolStatus.updateStatus('completed');
          return null;
        }

        if (isListingConversation && !effectiveIntentOutput) {
          const nextDraft = extractSellerListingDraft(
            message,
            sellerListingDraft ?? createEmptySellerListingDraft(),
          );
          const missingFields = getSellerListingMissingFields(nextDraft);
          const isReady = missingFields.length === 0;
          const replyText = isReady
            ? 'Looks good. Review the preview and tap Create listing to publish it.'
            : getSellerListingPrompt(nextDraft, validCategories);

          setSellerListingDraft(nextDraft);
          setMessages((currentMessages) => [
            ...currentMessages,
            userMessage,
            buildSellerListingAssistantMessage(replyText, nextDraft, isReady ? 'ready' : 'draft'),
          ]);
          setDraftMessage('');
          setErrorMessage(null);
          setLastFailedMessage(null);
          setActiveGuidance(null);
          setPausedReplyText(null);
          setIsSending(false);
          toolStatus.updateStatus('completed');
          return null;
        }
      }

      const requestPayload: ChatAPIRequest = {
        message,
        context: chatContext,
        role,
        intentOutput: effectiveIntentOutput,
        evidenceImages: options?.evidenceImages,
      };

      const assistantMessageId = createMessageId('assistant-stream');
      const assistantPlaceholder = buildStreamingAssistantMessage(assistantMessageId);
      const requestId = activeRequestIdRef.current + 1;
      activeRequestIdRef.current = requestId;
      activeRequestMessageIdRef.current = assistantMessageId;
      activeRequestFinalizedRef.current = false;

      setMessages((currentMessages) => [...currentMessages, userMessage, assistantPlaceholder]);
      setDraftMessage('');
      setErrorMessage(null);
      setLastFailedMessage(null);
      setActiveGuidance(null);
      setPausedReplyText(null);
      setIsSending(true);
      toolStatus.updateStatus('resolving_intent');
      activeRequestAbortReasonRef.current = null;

      const normalizedMessage = message.toLowerCase();
      const shouldShowRecommendationToast = /\b(recommend|suggest|gift|browse|discover)\b/.test(
        normalizedMessage,
      );
      const shouldWatchRefundFlow = isRefundRelatedMessage(message);
      let recommendationToastId: string | null = null;
      let recommendationToastTimer: number | null = null;
      let refundOrdersToastId: string | null = null;
      let refundOrdersToastTimer: number | null = null;
      let refundSubmitToastId: string | null = null;
      let refundSubmitToastTimer: number | null = null;

      if (shouldShowRecommendationToast) {
        recommendationToastTimer = window.setTimeout(() => {
          if (activeRequestIdRef.current !== requestId) {
            return;
          }

          recommendationToastId = addToast({
            message: 'Still fetching recommendations...',
            variant: 'info',
            durationMs: 4000,
          });
        }, RECOMMENDATION_TOAST_DELAY_MS);
      }

      if (shouldWatchRefundFlow) {
        refundOrdersToastTimer = window.setTimeout(() => {
          if (activeRequestIdRef.current !== requestId) {
            return;
          }

          refundOrdersToastId = addToast({
            message: 'Fetching your recent orders...',
            variant: 'info',
            durationMs: 0,
          });
        }, REFUND_ORDER_FETCH_TOAST_DELAY_MS);

        refundSubmitToastTimer = window.setTimeout(() => {
          if (activeRequestIdRef.current !== requestId) {
            return;
          }

          refundSubmitToastId = addToast({
            message: 'Submitting your refund...',
            variant: 'info',
            durationMs: 0,
          });
        }, REFUND_SUBMIT_TOAST_DELAY_MS);
      }

      let responseBody: ChatAPIResponse | null = null;
      const controller = new AbortController();
      activeRequestControllerRef.current = controller;
      type RequestOutcome = { kind: 'response'; response: Response } | { kind: 'timeout' };
      let resolveTimeoutRequest: ((value: RequestOutcome) => void) | null = null;
      const timeoutPromise = new Promise<RequestOutcome>((resolve) => {
        resolveTimeoutRequest = resolve;
      });
      const timeoutId = window.setTimeout(() => {
        if (activeRequestIdRef.current !== requestId || activeRequestFinalizedRef.current) {
          return;
        }

        activeRequestAbortReasonRef.current = 'timeout';
        activeRequestFinalizedRef.current = true;
        resolveTimeoutRequest?.({ kind: 'timeout' });
        controller.abort();
      }, CHAT_REQUEST_TIMEOUT_MS);
      activeRequestTimeoutIdRef.current = timeoutId;

      try {
        toolStatus.updateStatus('invoking_tool');

        // In manual fallback mode, return a default response
        if (!chatMode.isAgentic) {
          const fallbackResponse: ChatAPIResponse = {
            reply: FALLBACK_REPLY,
            updatedContext: chatContext,
            products: undefined,
            order: undefined,
            refundReferenceId: undefined,
            toolCall: undefined,
            toolError: undefined,
            intent: 'SUPPORT',
            isEscalation: true,
          };
          responseBody = fallbackResponse;

          const updatedMessages = [
            ...messages,
            userMessage,
            buildAssistantMessage(fallbackResponse),
          ];
          setMessages(updatedMessages);
          setChatContext(fallbackResponse.updatedContext);
          toolStatus.updateStatus('completed');
          setIsSending(false);
          setErrorMessage(null);
          setDraftMessage('');
          setPausedReplyText(null);
          if (isRefundRelatedMessage(message)) {
            setActiveGuidance({
              kind: 'refund',
              message:
                'Open Orders to continue the refund application manually, then choose the right order and tap Request Refund.',
            });
          }

          // Show toast notification about fallback mode
          addToast({
            message: 'Using manual fallback mode. For assistance, please contact support.',
            variant: 'info',
            durationMs: 5000,
          });

          return responseBody;
        }

        const endpoint =
          role === 'seller'
            ? '/api/seller/chat'
            : role === 'admin'
              ? '/api/admin/chat'
              : '/api/buyer/chat';
        const requestPromise = fetch(endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify(requestPayload),
          signal: controller.signal,
        });
        requestPromise.catch(() => {
          // The timeout or manual stop path handles the final UI state.
        });
        const requestOutcome = (await Promise.race([
          requestPromise.then((response) => ({ kind: 'response', response }) as const),
          timeoutPromise,
        ])) as RequestOutcome;

        if (
          activeRequestIdRef.current !== requestId ||
          activeRequestAbortReasonRef.current === 'manual'
        ) {
          return null;
        }

        if (requestOutcome.kind === 'timeout') {
          const errorText = `The chat request timed out after ${CHAT_REQUEST_TIMEOUT_SECONDS} seconds. Please try again.`;
          const replyText = isRefundRelatedMessage(message)
            ? buildRefundTimeoutReply(message, CHAT_REQUEST_TIMEOUT_SECONDS)
            : errorText;

          if (isRefundRelatedMessage(message)) {
            setActiveGuidance({
              kind: 'refund',
              message:
                'The assistant timed out, but you can still submit the refund manually from Orders.',
            });
          }

          setMessages((currentMessages) =>
            currentMessages.map((currentMessage) =>
              currentMessage.id === assistantMessageId
                ? buildTimeoutAssistantMessage(assistantMessageId, replyText, errorText)
                : currentMessage,
            ),
          );
          setPausedReplyText(null);
          if (isRefundRelatedMessage(message)) {
            addToast({
              message: 'Open Orders to submit the refund request manually.',
              variant: 'info',
              actionLabel: 'Open Orders',
              onAction: () => {
                window.location.href = REFUND_MANUAL_REQUEST_GUIDED_ROUTE;
              },
              durationMs: 0,
            });
          }
          setChatContext(createFallbackContext(chatContext, message));
          setErrorMessage(errorText);
          setLastFailedMessage(message);
          toolStatus.fail(errorText);
          return null;
        }

        const response = requestOutcome.response;
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

        responseBody = body;

        if (body.toolCall?.toolName?.startsWith('refund_')) {
          const toolName = body.toolCall.toolName;
          const toolError = body.toolError;
          const toolDetails = toolError?.details as
            | { mascotTrigger?: boolean; kind?: string }
            | undefined;

          if (toolError) {
            if (toolDetails?.mascotTrigger) {
              addToast({
                message:
                  'Refunds are temporarily unavailable. Please use Orders to submit manually.',
                variant: 'error',
                durationMs: 0,
                actionLabel: 'Open Orders',
                onAction: () => {
                  window.location.href = REFUND_MANUAL_REQUEST_GUIDED_ROUTE;
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

        if (role === 'seller' && body.toolCall?.toolName === 'seller_sales_summary') {
          const summaryResult = body.toolResult as
            | {
                totalItemsSold?: number;
                totalRevenue?: number;
                topProduct?: { product_id: string; name?: string | null; itemsSold: number } | null;
                pendingRefundCount?: number;
              }
            | undefined;

          if (
            summaryResult &&
            typeof summaryResult.totalItemsSold === 'number' &&
            typeof summaryResult.totalRevenue === 'number'
          ) {
            setSellerSalesSummary(
              buildSellerSalesSummaryPreview({
                totalItemsSold: summaryResult.totalItemsSold,
                totalRevenue: summaryResult.totalRevenue,
                topProduct: summaryResult.topProduct,
                pendingRefundCount: summaryResult.pendingRefundCount,
              }),
            );
          }
        }

        setChatContext(body.updatedContext);
        setActiveGuidance(null);
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
        const isAbortError = error instanceof DOMException && error.name === 'AbortError';
        const abortReason = activeRequestAbortReasonRef.current;

        if (activeRequestIdRef.current !== requestId && abortReason === 'manual') {
          return null;
        }

        if (isAbortError && abortReason === 'manual') {
          setMessages((currentMessages) =>
            currentMessages.map((currentMessage) =>
              currentMessage.id === assistantMessageId
                ? buildPausedAssistantMessage(assistantMessageId)
                : currentMessage,
            ),
          );

          if (activeRequestIdRef.current === requestId) {
            setErrorMessage(null);
            setLastFailedMessage(null);
            toolStatus.reset();
          }
        } else {
          const errorText =
            isAbortError || abortReason === 'timeout'
              ? `The chat request timed out after ${CHAT_REQUEST_TIMEOUT_SECONDS} seconds. Please try again.`
              : error instanceof Error
                ? error.message
                : 'Unable to send message.';
          const replyText =
            isAbortError || abortReason === 'timeout'
              ? isRefundRelatedMessage(message)
                ? buildRefundTimeoutReply(message, CHAT_REQUEST_TIMEOUT_SECONDS)
                : errorText
              : FALLBACK_REPLY;

          setMessages((currentMessages) =>
            currentMessages.map((currentMessage) =>
              currentMessage.id === assistantMessageId
                ? buildTimeoutAssistantMessage(assistantMessageId, replyText, errorText)
                : currentMessage,
            ),
          );

          if (activeRequestIdRef.current === requestId) {
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
          }
        }
      } finally {
        const abortReason = activeRequestAbortReasonRef.current;
        window.clearTimeout(timeoutId);
        if (activeRequestTimeoutIdRef.current === timeoutId) {
          activeRequestTimeoutIdRef.current = null;
        }
        if (recommendationToastTimer) {
          window.clearTimeout(recommendationToastTimer);
        }
        if (activeRequestIdRef.current === requestId) {
          setIsSending(false);
          activeRequestControllerRef.current = null;
          activeRequestAbortReasonRef.current = null;
          activeRequestMessageIdRef.current = null;
          if (abortReason !== 'manual') {
            setPausedReplyText(null);
          }
        }
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

      return responseBody;
    },
    [
      addToast,
      chatContext,
      dismissToast,
      draftMessage,
      isSending,
      chatMode.isAgentic,
      CHAT_REQUEST_TIMEOUT_MS,
      CHAT_REQUEST_TIMEOUT_SECONDS,
      messages,
      role,
      sellerId,
      isSellerAuthLoaded,
      sellerListingDraft,
      sellerSalesSummary,
      validCategories,
      setChatContext,
      setDraftMessage,
      setErrorMessage,
      setIsSending,
      setLastFailedMessage,
      setMessages,
      toolStatus,
    ],
  );

  const handleCreateSellerListing = useCallback(() => {
    if (role !== 'seller' || !sellerListingDraft || isSending) {
      return;
    }

    const missingFields = getSellerListingMissingFields(sellerListingDraft);
    if (missingFields.length > 0) {
      setErrorMessage(`Please finish the listing draft: ${missingFields.join(', ')}.`);
      return;
    }

    if (!sellerId) {
      setErrorMessage(
        'Please sign in again so I can publish this listing from your seller account.',
      );
      return;
    }

    const intentOutput = buildSellerListingIntentOutput(sellerListingDraft, sellerId);
    void handleSend('Publish this listing.', { intentOutput });
  }, [handleSend, isSending, role, sellerId, sellerListingDraft]);

  const handleApproveAllRefunds = useCallback(() => {
    if (role !== 'seller' || isSending) {
      return;
    }

    void handleSend('approve all refunds');
  }, [handleSend, isSending, role]);

  const handleRequestSellerSalesSummary = useCallback(() => {
    if (role !== 'seller' || isSending) {
      return;
    }

    void handleSend('How are my sales this week?');
  }, [handleSend, isSending, role]);

  const handleRefundSubmit = useCallback(async () => {
    if (!selectedOrder || isRefundSubmitting || isSending) {
      return;
    }

    if (evidenceManager.validation && !evidenceManager.validation.valid) {
      setRefundError(evidenceManager.validation.reason ?? 'Please fix the evidence upload issue.');
      return;
    }

    setRefundError(null);
    setIsRefundSubmitting(true);

    try {
      let evidenceUrls: string[] = [];
      if (evidenceManager.files.length > 0) {
        setIsRefundUploading(true);
        evidenceUrls = await uploadRefundEvidence(evidenceManager.files, selectedOrder.order_id);
      }

      const intentOutput = {
        intent: 'REFUND_REQUEST',
        payload: {
          orderSignal: { orderId: selectedOrder.order_id },
          reason: 'other',
          reasonDescription: refundComments.trim() || undefined,
          evidence: evidenceUrls.length > 0 ? 'photo_attached' : 'no_photo',
          evidenceImages: evidenceUrls.length > 0 ? evidenceUrls : undefined,
          requestedAmount: selectedOrder.total_amount,
          currency: selectedOrder.currency,
        },
        metadata: {
          source: 'chat-refund-flow',
        },
      };

      const userMessage = `Submit refund request for order #${
        selectedOrder.order_number || selectedOrder.order_id.slice(0, 8)
      }.`;

      const response = await handleSend(userMessage, {
        intentOutput,
        evidenceImages: evidenceUrls,
      });

      if (response?.refundReferenceId) {
        setSelectedOrder(null);
        setRefundComments('');
        evidenceManager.clear();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Refund submission failed.';
      setRefundError(message);
    } finally {
      setIsRefundUploading(false);
      setIsRefundSubmitting(false);
    }
  }, [
    evidenceManager,
    handleSend,
    isRefundSubmitting,
    isSending,
    refundComments,
    selectedOrder,
    uploadRefundEvidence,
  ]);

  if (!shouldRender) {
    return null;
  }

  return (
    <>
      {isMobileOverlayOpen ? (
        <button
          type="button"
          aria-label="Close chat backdrop"
          data-testid="buyer-chatbot-backdrop"
          className="fixed inset-0 z-[190] cursor-default bg-slate-950/35 backdrop-blur-[2px]"
          onClick={() => {
            hasInteractedRef.current = true;
            closeChat();
          }}
        />
      ) : null}

      <div
        className={`pointer-events-none fixed ${
          isFullscreenLayout
            ? isMobileOverlayOpen
              ? 'inset-0 z-[200] p-2 sm:p-4'
              : 'inset-0 z-[200] p-0'
            : `${positionClassName} z-[200]`
        } flex flex-col ${isFullscreenLayout ? 'items-stretch justify-stretch' : 'items-end justify-end'} gap-3 font-sans`}
      >
        <ToastList toasts={toasts} onDismiss={dismissToast} />
        <motion.div
          data-testid="buyer-chatbot-panel"
          key={sessionGeneration}
          className={`relative flex min-h-0 flex-col overflow-hidden border border-rose-100 bg-rose-50/95 shadow-[0_24px_70px_rgba(15,23,42,0.16),inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-xl ${
            isMobileOverlayOpen
              ? 'pointer-events-auto h-[calc(100dvh-1rem)] w-full rounded-[1.75rem] sm:h-[calc(100dvh-2rem)] sm:max-w-md sm:self-end sm:rounded-3xl'
              : isDesktopFullscreen
                ? 'pointer-events-auto h-[100dvh] w-[100vw] rounded-none border-0 shadow-none'
                : `pointer-events-auto h-[min(30rem,calc(100dvh-2rem))] w-[min(40rem,calc(100vw-1.5rem))] rounded-3xl ${
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
              <div className="flex items-center gap-2">
                <p className="text-xs text-slate-500 sm:text-sm">
                  {chatMode.isAgentic
                    ? 'BuySmart assistant - typically replies in minutes'
                    : 'Manual mode - please contact support'}
                </p>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    chatMode.isAgentic
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${chatMode.isAgentic ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  />
                  {chatMode.isAgentic ? 'Agentic' : 'Manual'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const newMode =
                    chatMode.currentMode === 'agentic' ? 'manual-fallback' : 'agentic';
                  chatMode.toggle(newMode);
                  if (newMode === 'agentic') {
                    setActiveGuidance(null);
                  }
                  const message =
                    newMode === 'agentic'
                      ? 'Switched to AI mode.'
                      : 'Switched to manual support mode.';
                  addToast({
                    message,
                    variant: 'info',
                    durationMs: 2000,
                  });
                }}
                className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 ${
                  chatMode.isAgentic
                    ? 'border-rose-100 bg-white text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)] hover:bg-rose-50 focus-visible:ring-rose-200'
                    : 'border-amber-200 bg-amber-50 text-amber-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)] hover:bg-amber-100 focus-visible:ring-amber-200'
                }`}
                title={
                  chatMode.isAgentic ? 'Agentic Mode (AI Assistant Active)' : 'Manual Fallback Mode'
                }
                aria-label={
                  chatMode.isAgentic
                    ? 'Agentic mode active. Click to enable manual fallback mode.'
                    : 'Manual fallback mode active. Click to enable agentic mode.'
                }
              >
                <Zap className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsFullscreen((current) => !current);
                }}
                className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-rose-100 bg-white text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)] transition hover:-translate-y-0.5 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200 sm:inline-flex"
                aria-label={
                  isDesktopFullscreen ? 'Exit full-screen chat' : 'Enter full-screen chat'
                }
                title={isDesktopFullscreen ? 'Exit full-screen chat' : 'Enter full-screen chat'}
              >
                {isDesktopFullscreen ? (
                  <Minimize2 className="h-5 w-5" />
                ) : (
                  <Maximize2 className="h-5 w-5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  hasInteractedRef.current = true;
                  closeChat();
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
          </div>

          <div className="flex min-h-0 flex-1 flex-col bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.72),rgba(255,241,242,0.5))]">
            <motion.div
              ref={scrollRef}
              onScroll={() => {
                const scrollEl = scrollRef.current;
                if (!scrollEl) {
                  return;
                }

                const distanceFromBottom =
                  scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;
                setShouldAutoScroll(distanceFromBottom < 80);
              }}
              onWheel={() => {
                // Any wheel interaction implies the user wants to control scrolling
                setShouldAutoScroll(false);
              }}
              onTouchStart={() => {
                // Touch interactions likewise
                setShouldAutoScroll(false);
              }}
              className="chatbot-scrollbar flex-1 space-y-4 overflow-y-auto px-4 pr-6 md:pr-12 pt-3 pb-20 md:pb-24"
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
                      className={`flex items-start gap-3 min-w-0 ${isAssistant ? '' : 'justify-end'}`}
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

                      <div
                        className={`max-w-[82%] md:max-w-[76%] space-y-2 ${isAssistant ? '' : 'items-end'}`}
                      >
                        <div
                          className={`rounded-2xl px-4 py-3 text-sm leading-6 shadow-[0_10px_24px_rgba(15,23,42,0.08)] transition-transform duration-200 ease-out hover:-translate-y-0.5 ${
                            isAssistant
                              ? 'rounded-tl-md border border-white/80 bg-white/90 text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.95)]'
                              : 'rounded-tr-md border border-rose-300/40 bg-rose-500 text-white shadow-[0_10px_24px_rgba(244,63,94,0.16),inset_0_1px_0_rgba(255,255,255,0.18)]'
                          }`}
                        >
                          {message.status === 'streaming' ? (
                            <div className="space-y-2 text-slate-500">
                              <div className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>{message.text}</span>
                              </div>
                              <button
                                type="button"
                                onClick={stopActiveRequest}
                                className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-3 py-1 text-[11px] font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                                aria-label="Pause reply"
                              >
                                <Square className="h-3.5 w-3.5" />
                                Pause reply
                              </button>
                            </div>
                          ) : (
                            <p>{message.text}</p>
                          )}

                          {message.status === 'error' || message.status === 'timeout' ? (
                            <div
                              className={`mt-3 space-y-2 rounded-xl px-3 py-2 ${
                                message.status === 'timeout'
                                  ? 'border border-amber-100 bg-amber-50 text-amber-800'
                                  : 'border border-rose-100 bg-rose-50 text-rose-700'
                              }`}
                            >
                              <p className="text-xs font-medium">
                                {message.status === 'timeout'
                                  ? (message.errorMessage ??
                                    'The assistant is taking longer than expected.')
                                  : (message.errorMessage ?? 'Unable to complete this message.')}
                              </p>
                              {message.retryable && lastFailedMessage ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    void handleSend(lastFailedMessage);
                                  }}
                                  className={`rounded-full border bg-white px-3 py-1 text-[11px] font-semibold transition ${
                                    message.status === 'timeout'
                                      ? 'border-amber-200 text-amber-800 hover:border-amber-300 hover:bg-amber-100'
                                      : 'border-rose-200 text-rose-700 hover:border-rose-300 hover:bg-rose-100'
                                  }`}
                                >
                                  Retry
                                </button>
                              ) : null}

                              {message.status === 'timeout' &&
                              /open orders|request refund|refund status/i.test(message.text) ? (
                                <div className="mt-2 overflow-hidden rounded-xl border border-rose-200 bg-white/85 px-3 py-2 text-rose-700">
                                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-500/80">
                                    <span>Manual refund path</span>
                                    <motion.span
                                      aria-hidden="true"
                                      animate={{ x: [0, 8, 0], opacity: [0.55, 1, 0.55] }}
                                      transition={{
                                        duration: 1.5,
                                        repeat: Infinity,
                                        ease: 'easeInOut',
                                      }}
                                      className="text-rose-400"
                                    >
                                      →
                                    </motion.span>
                                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-700">
                                      Orders
                                    </span>
                                    <motion.span
                                      aria-hidden="true"
                                      animate={{ x: [0, 8, 0], opacity: [0.55, 1, 0.55] }}
                                      transition={{
                                        duration: 1.5,
                                        repeat: Infinity,
                                        ease: 'easeInOut',
                                        delay: 0.15,
                                      }}
                                      className="text-rose-400"
                                    >
                                      →
                                    </motion.span>
                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">
                                      Request Refund
                                    </span>
                                  </div>
                                  <div className="mt-2 flex items-center justify-between gap-3">
                                    <p className="text-[11px] leading-5 text-slate-600">
                                      Open Orders to submit the refund request manually.
                                    </p>
                                    <a
                                      href={REFUND_MANUAL_REQUEST_GUIDED_ROUTE}
                                      className="inline-flex shrink-0 items-center justify-center rounded-full bg-rose-500 px-3 py-2 text-[11px] font-semibold text-white shadow-[0_10px_20px_rgba(244,63,94,0.16)] transition hover:-translate-y-0.5 hover:bg-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200"
                                    >
                                      Open Orders
                                    </a>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          ) : null}

                          {message.products && message.products.length > 0 ? (
                            <div className="mt-3 space-y-2">
                              {message.products.map((product) => (
                                <div
                                  key={product.id}
                                  className="rounded-xl border border-rose-100 bg-white/80 px-3 py-2 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] max-w-full"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="font-medium text-slate-900 truncate">
                                        {product.name}
                                      </p>
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
                                  isSelected={selectedOrder?.order_id === order.order_id}
                                  onSelect={handleOrderSelect}
                                />
                              ))}
                            </div>
                          ) : null}

                          {message.sellerListingPreview ? (
                            <div className="mt-3">
                              <SellerListingPreviewCard
                                preview={message.sellerListingPreview}
                                onCreate={handleCreateSellerListing}
                                onClear={() => {
                                  setSellerListingDraft(null);
                                  setDraftMessage('');
                                  setErrorMessage(null);
                                  setLastFailedMessage(null);
                                }}
                                isSubmitting={isSending}
                              />
                            </div>
                          ) : null}
                          {message.sellerSalesSummaryPreview ? (
                            <div className="mt-3">
                              <SellerSalesSummaryCard
                                preview={message.sellerSalesSummaryPreview}
                                onApproveAllRefunds={handleApproveAllRefunds}
                                isApproving={isSending}
                              />
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

            {pausedReplyText ? (
              <div className="mx-4 mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] sm:mx-5">
                <p className="font-semibold">Reply paused</p>
                <p className="mt-1 leading-5">{pausedReplyText}</p>
              </div>
            ) : null}

            {/* removed floating submit button to simplify layout */}

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

              {role === 'seller' ? (
                <div className="mb-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleRequestSellerSalesSummary}
                    disabled={isSending}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    How are my sales this week?
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleSend('Add a new product');
                    }}
                    disabled={isSending}
                    className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-[11px] font-semibold text-sky-700 transition hover:border-sky-300 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Add a new product
                  </button>
                  <button
                    type="button"
                    onClick={handleApproveAllRefunds}
                    disabled={isSending}
                    className="rounded-full border border-rose-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Approve all refunds
                  </button>
                </div>
              ) : null}

              {selectedOrder ? (
                <div className="mb-3 rounded-2xl border border-rose-100 bg-rose-50/70 p-3 text-xs text-slate-700">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-800">Refund request</p>
                      <p className="text-[11px] text-slate-500">
                        Order #{selectedOrder.order_number || selectedOrder.order_id.slice(0, 8)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOrder(null);
                        setRefundComments('');
                        setRefundError(null);
                        evidenceManager.clear();
                      }}
                      className="rounded-full border border-rose-200 bg-white px-3 py-1 text-[11px] font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                    >
                      Change order
                    </button>
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold text-slate-600">Photo evidence</p>
                      <span className="text-[10px] text-slate-500">
                        {evidenceManager.files.length}/{evidenceManager.maxFiles} images
                      </span>
                    </div>
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-rose-200 bg-white px-3 py-2 text-[11px] font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100">
                      <Paperclip className="h-3 w-3" />
                      Upload photos
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) => {
                          if (event.target.files && event.target.files.length > 0) {
                            evidenceManager.attach(event.target.files);
                          }
                          event.target.value = '';
                        }}
                      />
                    </label>

                    {evidenceManager.validation && !evidenceManager.validation.valid ? (
                      <div className="text-[11px] text-rose-600">
                        {evidenceManager.validation.reason}
                      </div>
                    ) : null}

                    {evidencePreviews.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2">
                        {evidencePreviews.map((preview, index) => (
                          <div
                            key={`${preview.name}-${index}`}
                            className="relative h-16 w-full overflow-hidden rounded-lg border border-rose-100"
                          >
                            <Image
                              src={preview.url}
                              alt={preview.name}
                              fill
                              sizes="96px"
                              className="object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => evidenceManager.removeAt(index)}
                              className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-rose-600 shadow"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3">
                    <label
                      htmlFor="refund-comments"
                      className="text-[11px] font-semibold text-slate-600"
                    >
                      Comments (optional)
                    </label>
                    <textarea
                      id="refund-comments"
                      value={refundComments}
                      onChange={(event) => setRefundComments(event.target.value)}
                      rows={3}
                      placeholder="Share any details about the issue..."
                      className="mt-1 w-full rounded-xl border border-rose-100 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm outline-none focus:border-rose-200 focus:ring-2 focus:ring-rose-100"
                    />
                  </div>

                  {refundError ? (
                    <div className="mt-2 rounded-lg border border-rose-200 bg-white px-2 py-1 text-[11px] text-rose-700">
                      {refundError}
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => void handleRefundSubmit()}
                    disabled={isRefundSubmitting || isRefundUploading}
                    className="mt-3 w-full rounded-full bg-rose-500 py-2 text-xs font-semibold text-white shadow transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:bg-rose-300"
                  >
                    {isRefundUploading
                      ? 'Uploading photos...'
                      : isRefundSubmitting
                        ? 'Submitting refund...'
                        : 'Submit refund request'}
                  </button>
                </div>
              ) : null}

              {isLocalhost ? (
                <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
                  <div>
                    <p className="font-semibold">Local timeout mode</p>
                    <p className="mt-1 text-[11px] text-sky-800">
                      Fast timeout is only active on localhost.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUseLocalTimeout((current) => !current)}
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                      useLocalTimeout
                        ? 'bg-sky-600 text-white hover:bg-sky-700'
                        : 'bg-white text-sky-700 hover:bg-sky-100'
                    }`}
                    aria-pressed={useLocalTimeout}
                  >
                    {useLocalTimeout ? 'Fast' : 'Normal'}
                  </button>
                </div>
              ) : null}

              {!chatMode.isAgentic ? (
                <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
                  <p className="font-semibold">Manual support mode active</p>
                  <p className="mt-1 text-[11px] text-amber-800">
                    This chat is in manual fallback mode. For immediate assistance, please contact
                    our support team directly.
                  </p>
                </div>
              ) : null}

              <AnimatePresence mode="wait">
                {activeGuidance?.kind === 'refund' ? (
                  <RefundGuidanceCard
                    key="refund-guidance"
                    message={activeGuidance.message}
                    onOpenOrders={() => {
                      window.location.href = REFUND_MANUAL_REQUEST_GUIDED_ROUTE;
                    }}
                    onDismiss={() => setActiveGuidance(null)}
                  />
                ) : null}
              </AnimatePresence>

              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-[0_10px_24px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.95)] focus-within:border-rose-200 focus-within:ring-2 focus-within:ring-rose-100">
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
                  disabled={isSending || !chatMode.isAgentic}
                  className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Type a message"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (isSending) {
                      stopActiveRequest();
                      return;
                    }

                    void handleSend();
                  }}
                  disabled={!chatMode.isAgentic || (!isSending && !draftMessage.trim())}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white shadow-[0_10px_20px_rgba(244,63,94,0.18),inset_0_1px_0_rgba(255,255,255,0.25)] transition-transform hover:-translate-y-0.5 hover:bg-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200 disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-rose-300"
                  aria-label={isSending ? 'Stop generating' : 'Send message'}
                >
                  {isSending ? <Square className="h-4 w-4" /> : <Send className="h-4 w-4" />}
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
              setIsOpen((current) => {
                if (!current) {
                  setShouldAutoScroll(true);
                }

                return !current;
              });
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
