"use client";

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { MessageCircle, Send, X, Sparkles } from 'lucide-react';

const SESSION_STORAGE_KEY = 'buysmart.buyer-chat-widget-open';
const SESSION_STORAGE_SENT_KEY = 'buysmart.buyer-chat-widget-has-sent-message';

export default function BuyerChatbotWidget() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [draftMessage, setDraftMessage] = useState('');
  const [hasSentMessage, setHasSentMessage] = useState(false);
  const shouldRender =
    pathname === '/' ||
    pathname.startsWith('/buyer') ||
    pathname.startsWith('/orders/');

  const shouldLiftWidget =
    pathname === '/buyer/cart' ||
    pathname === '/buyer/checkout' ||
    pathname === '/buyer/order-confirmation' ||
    pathname.startsWith('/orders/');
  const positionClassName = shouldLiftWidget
    ? 'bottom-28 right-4 md:bottom-10 md:right-8'
    : 'bottom-20 right-4 md:bottom-8 md:right-6';

  useEffect(() => {
    setHasLoaded(true);

    try {
      const storedValue = sessionStorage.getItem(SESSION_STORAGE_KEY);
      const storedHasSentMessage = sessionStorage.getItem(SESSION_STORAGE_SENT_KEY);

      if (storedValue === 'true') {
        setIsOpen(true);
      }

      if (storedHasSentMessage === 'true') {
        setHasSentMessage(true);
      }
    } catch {
      setIsOpen(false);
      setHasSentMessage(false);
    }
  }, []);

  useEffect(() => {
    if (!hasLoaded) {
      return;
    }

    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, String(isOpen));
      sessionStorage.setItem(SESSION_STORAGE_SENT_KEY, String(hasSentMessage));
    } catch {
      // Ignore storage failures and keep the widget functional.
    }
  }, [hasLoaded, hasSentMessage, isOpen]);

  function handleSend() {
    if (!draftMessage.trim()) {
      return;
    }

    setHasSentMessage(true);
    setDraftMessage('');
  }

  if (!shouldRender) {
    return null;
  }

  return (
    <div className={`pointer-events-none fixed ${positionClassName} z-30 flex flex-col items-end gap-3 font-sans`}>
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
            <p className="text-xs text-white/85 sm:text-sm">BuySmart assistant - typically replies in minutes</p>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
            aria-label="Close chat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex h-[min(22rem,calc(100dvh-12rem))] flex-col bg-rose-50/40 sm:h-[min(24rem,calc(100dvh-12rem))]">
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
            <div className="flex items-start gap-3">
              {!hasSentMessage ? (
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

              <div className="max-w-[82%] space-y-1">
                <div className="rounded-2xl rounded-tl-md bg-white px-4 py-3 text-sm leading-6 text-slate-700 shadow-sm ring-1 ring-slate-100">
                  Hi there! How can I help you today?
                </div>
                <p className="px-1 text-[11px] text-slate-400">Just now</p>
              </div>
            </div>
          </div>

          <div className="border-t border-rose-100 bg-white px-4 py-3">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 shadow-sm focus-within:border-rose-300 focus-within:ring-2 focus-within:ring-rose-100">
              <input
                type="text"
                placeholder="Type a message..."
                value={draftMessage}
                onChange={(event) => setDraftMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleSend();
                  }
                }}
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                aria-label="Type a message"
              />
              <button
                type="button"
                onClick={handleSend}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white transition-transform hover:-translate-y-0.5 hover:bg-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
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
          onClick={() => setIsOpen((current) => !current)}
          className={`relative flex h-14 w-14 items-center justify-center rounded-full bg-linear-to-r from-rose-500 via-rose-500 to-pink-500 text-white shadow-2xl shadow-rose-500/30 transition-transform duration-300 hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-200 ${
            hasLoaded && !isOpen ? 'animate-[bounce_1.4s_ease-in-out_1]' : ''
          }`}
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Close chat' : 'Open chat'}
        >
          <MessageCircle className="h-6 w-6" />

          {!isOpen ? (
            <span className="absolute right-0 top-0 h-3 w-3 rounded-full bg-red-500 ring-2 ring-white">
              <span className="absolute inset-0 rounded-full bg-red-500 opacity-75 animate-ping" />
            </span>
          ) : null}
        </button>
      </div>
    </div>
  );
}
