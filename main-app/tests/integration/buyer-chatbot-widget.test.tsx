/** @vitest-environment jsdom */

import React from 'react';
import { act, render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BuyerChatbotWidget from '@/components/shared/buyer-chatbot-widget';
import { getChatbotStorageKeys } from '@/lib/chatbot/session';

const pathnameState = vi.hoisted(() => ({
  value: '/buyer',
}));

const supabaseState = vi.hoisted(() => ({
  user: null as { id: string } | null,
  authCallback: null as
    | ((event: 'SIGNED_IN' | 'SIGNED_OUT', session: { user: { id: string } } | null) => void)
    | null,
  unsubscribe: vi.fn(),
}));

const mediaQueryState = vi.hoisted(() => ({
  matches: false,
}));

const buyerStorageKeys = getChatbotStorageKeys('buyer');

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameState.value,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockImplementation(async () => ({
        data: { user: supabaseState.user },
        error: null,
      })),
      onAuthStateChange: vi.fn().mockImplementation((callback) => {
        supabaseState.authCallback = callback;
        return {
          data: {
            subscription: {
              unsubscribe: supabaseState.unsubscribe,
            },
          },
        };
      }),
    },
  }),
}));

vi.mock('next/image', () => ({
  default: ({ fill, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => {
    void fill;
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} alt={props.alt} />;
  },
}));

function jsonResponse(payload: unknown, ok = true): Response {
  return {
    ok,
    json: async () => payload,
  } as Response;
}

function mockMatchMedia() {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: mediaQueryState.matches && query.includes('max-width: 640px'),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe('BuyerChatbotWidget', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    Element.prototype.scrollTo = vi.fn();
    pathnameState.value = '/buyer';
    supabaseState.user = null;
    supabaseState.authCallback = null;
    supabaseState.unsubscribe.mockReset();
    mediaQueryState.matches = false;
    mockMatchMedia();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders on public guest routes', () => {
    pathnameState.value = '/products';

    render(<BuyerChatbotWidget />);

    expect(screen.getByRole('button', { name: 'Open chat' })).toBeInTheDocument();
  });

  it('opens as a full-screen overlay on small screens', async () => {
    mediaQueryState.matches = true;
    mockMatchMedia();

    render(<BuyerChatbotWidget />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Open chat' }));

    const panel = screen.getByTestId('buyer-chatbot-panel');
    expect(panel).toHaveClass('w-full');
    expect(panel).toHaveClass('h-[calc(100dvh-1rem)]');
    expect(screen.getByRole('button', { name: 'Close chat backdrop' })).toBeInTheDocument();
    expect(screen.getByTestId('buyer-chatbot-backdrop')).toHaveClass('fixed', 'inset-0');
  });

  it('opens at a large but bounded size by default on desktop', async () => {
    render(<BuyerChatbotWidget />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Open chat' }));

    const panel = screen.getByTestId('buyer-chatbot-panel');
    expect(panel).toHaveClass('h-[min(30rem,calc(100dvh-2rem))]');
    expect(panel).toHaveClass('w-[min(40rem,calc(100vw-1.5rem))]');
    expect(panel).toHaveClass('rounded-3xl');
    expect(screen.queryByRole('button', { name: 'Close chat backdrop' })).not.toBeInTheDocument();
  });

  it('sends messages to the chat API and renders structured assistant replies', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        intent: 'PRODUCT_SEARCH',
        reply: 'Searching for category: phone, under 20000 taka.',
        products: [
          {
            id: 'p1',
            name: 'Redmi Note 13 Pro',
            price: 18999,
            category: 'phone',
            images: [],
            stock_available: true,
            features: ['gaming'],
            badge: 'Best battery',
          },
        ],
        updatedContext: {
          category: 'phone',
          price_max: 20000,
          lastOrderId: null,
          history: [
            { role: 'user', content: 'Need a phone under 20000' },
            { role: 'assistant', content: 'Searching for category: phone, under 20000 taka.' },
          ],
        },
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

    render(<BuyerChatbotWidget />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Open chat' }));
    await user.type(screen.getByLabelText('Type a message'), 'Need a phone under 20000');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/buyer/chat',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    expect(await screen.findByText('Searching for category: phone, under 20000 taka.')).toBeInTheDocument();
    expect(screen.getByText('Redmi Note 13 Pro')).toBeInTheDocument();
    expect(screen.getByText('BDT 18,999')).toBeInTheDocument();
  });

  it('shows an in-message streaming state while the assistant is pending', async () => {
    let resolveFetch!: (value: Response) => void;
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    vi.stubGlobal('fetch', fetchMock);

    render(<BuyerChatbotWidget />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Open chat' }));
    await user.type(screen.getByLabelText('Type a message'), 'Need a phone under 20000');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(screen.getByText('Thinking about that now...')).toBeInTheDocument();

    resolveFetch(
      jsonResponse({
        intent: 'PRODUCT_SEARCH',
        reply: 'Searching for category: phone, under 20000 taka.',
        updatedContext: {
          category: 'phone',
          price_max: 20000,
          lastOrderId: null,
          history: [],
        },
      }),
    );

    expect(await screen.findByText('Searching for category: phone, under 20000 taka.')).toBeInTheDocument();
  });

  it('lets the user stop a pending reply and continue typing', async () => {
    const fetchMock = vi.fn().mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        }),
    );

    vi.stubGlobal('fetch', fetchMock);

    render(<BuyerChatbotWidget />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Open chat' }));
    await user.type(screen.getByLabelText('Type a message'), 'Need a phone under 20000');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(screen.getByRole('button', { name: 'Stop generating' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Stop generating' }));

    expect(await screen.findByText('Reply paused. You can send another message now.')).toBeInTheDocument();
    expect(screen.getByLabelText('Type a message')).toBeEnabled();

    await user.type(screen.getByLabelText('Type a message'), 'Hello again');
    expect(screen.getByRole('button', { name: 'Send message' })).toBeEnabled();
  });

  it('times out a stalled reply and restores the input', async () => {
    vi.useFakeTimers();

    const fetchMock = vi.fn().mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        }),
    );

    vi.stubGlobal('fetch', fetchMock);

    render(<BuyerChatbotWidget />);

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByRole('button', { name: 'Open chat' }));
    await user.type(screen.getByLabelText('Type a message'), 'Track my order');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(21000);
    });

    expect(screen.getByText('The chat request timed out after 20 seconds. Please try again.')).toBeInTheDocument();
    expect(screen.getByLabelText('Type a message')).toBeEnabled();
  });

  it('uses refund fallback copy when a refund-related reply times out', async () => {
    vi.useFakeTimers();

    const fetchMock = vi.fn().mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        }),
    );

    vi.stubGlobal('fetch', fetchMock);

    render(<BuyerChatbotWidget />);

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByRole('button', { name: 'Open chat' }));
    await user.type(screen.getByLabelText('Type a message'), 'Refund request for order ORD-1001');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(21000);
    });

    expect(
      screen.getByText(
        'The chat request timed out after 20 seconds. Tap Orders, open View details for order ORD-1001, then use Request Refund.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Type a message')).toBeEnabled();
  });

  it('shows a fallback reply and surfaces API errors when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'Service unavailable' }, false)));

    render(<BuyerChatbotWidget />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Open chat' }));
    await user.type(screen.getByLabelText('Type a message'), 'Track my order');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(
      await screen.findByText(
        "I couldn't reach the BuySmart assistant just now. Please try again in a moment, and if this keeps happening we can connect you with support.",
      ),
    ).toBeInTheDocument();
    expect(await screen.findAllByText('Service unavailable')).toHaveLength(2);

    await waitFor(() => {
      expect(screen.getByLabelText('Type a message')).toBeEnabled();
    });
  });

  it('falls back safely when the API returns a malformed success payload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ ok: true })));

    render(<BuyerChatbotWidget />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Open chat' }));
    await user.type(screen.getByLabelText('Type a message'), 'Refund policy?');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(
      await screen.findByText(
        "I couldn't reach the BuySmart assistant just now. Please try again in a moment, and if this keeps happening we can connect you with support.",
      ),
    ).toBeInTheDocument();
    expect(await screen.findAllByText('The chat service returned an unexpected response.')).toHaveLength(2);
  });

  it('resets chat history after sign in', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        intent: 'FAQ',
        reply: 'I can help with products, orders, refunds, or support.',
        updatedContext: {
          category: null,
          price_max: null,
          lastOrderId: null,
          history: [
            { role: 'user', content: 'hello' },
            { role: 'assistant', content: 'I can help with products, orders, refunds, or support.' },
          ],
        },
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

    render(<BuyerChatbotWidget />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Open chat' }));
    await user.type(screen.getByLabelText('Type a message'), 'hello');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(await screen.findByText('I can help with products, orders, refunds, or support.')).toBeInTheDocument();

    await waitFor(() => {
      expect(supabaseState.authCallback).not.toBeNull();
    });
    act(() => {
      supabaseState.authCallback?.('SIGNED_IN', { user: { id: 'user-1' } });
    });

    await waitFor(() => {
      expect(screen.getByText('Hi there! How can I help you today?')).toBeVisible();
    });
  });

  it('resets chat history after sign out', async () => {
    window.sessionStorage.setItem(
      buyerStorageKeys.messages,
      JSON.stringify([
        { id: 'assistant-greeting', role: 'assistant', text: 'Hi there! How can I help you today?' },
        { id: 'user-1', role: 'user', text: 'Need help' },
      ]),
    );
    window.sessionStorage.setItem(
      buyerStorageKeys.context,
      JSON.stringify({
        category: 'phone',
        price_max: 20000,
        lastOrderId: null,
        history: [{ role: 'user', content: 'Need help' }],
      }),
    );

    render(<BuyerChatbotWidget />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Open chat' }));

    expect(screen.getByText('Need help')).toBeInTheDocument();

    await waitFor(() => {
      expect(supabaseState.authCallback).not.toBeNull();
    });
    act(() => {
      supabaseState.authCallback?.('SIGNED_OUT', null);
    });

    await waitFor(() => {
      const messages = JSON.parse(window.sessionStorage.getItem(buyerStorageKeys.messages) ?? '[]');
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({
        id: 'assistant-greeting',
        role: 'assistant',
        text: 'Hi there! How can I help you today?',
      });
    });

    await waitForElementToBeRemoved(() => screen.getByText('Need help'));

    await user.click(screen.getByRole('button', { name: 'Open chat' }));

    await waitFor(() => {
      expect(screen.getByText('Hi there! How can I help you today?')).toBeVisible();
    });
  });

  it('does not restore guest chat history after a signed-in reload', async () => {
    supabaseState.user = { id: 'user-42' };

    window.sessionStorage.setItem(
      buyerStorageKeys.messages,
      JSON.stringify([
        { id: 'assistant-greeting', role: 'assistant', text: 'Hi there! How can I help you today?' },
        { id: 'guest-1', role: 'user', text: 'guest message' },
      ]),
    );
    window.sessionStorage.setItem(
      buyerStorageKeys.context,
      JSON.stringify({
        category: null,
        price_max: null,
        lastOrderId: null,
        history: [{ role: 'user', content: 'guest message' }],
      }),
    );
    window.sessionStorage.setItem(buyerStorageKeys.authMarker, 'guest');

    render(<BuyerChatbotWidget />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Open chat' }));

    await waitFor(() => {
      expect(screen.queryByText('guest message')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Hi there! How can I help you today?')).toBeInTheDocument();
  });
});
