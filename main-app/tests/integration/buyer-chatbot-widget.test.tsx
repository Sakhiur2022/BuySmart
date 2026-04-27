/** @vitest-environment jsdom */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BuyerChatbotWidget from '@/components/shared/buyer-chatbot-widget';

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
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} alt={props.alt} />,
}));

function jsonResponse(payload: unknown, ok = true): Response {
  return {
    ok,
    json: async () => payload,
  } as Response;
}

describe('BuyerChatbotWidget', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    Element.prototype.scrollTo = vi.fn();
    pathnameState.value = '/buyer';
    supabaseState.user = null;
    supabaseState.authCallback = null;
    supabaseState.unsubscribe.mockReset();
  });

  it('renders on public guest routes', () => {
    pathnameState.value = '/products';

    render(<BuyerChatbotWidget />);

    expect(screen.getByRole('button', { name: 'Open chat' })).toBeInTheDocument();
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
        '/api/chat',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    expect(await screen.findByText('Searching for category: phone, under 20000 taka.')).toBeInTheDocument();
    expect(screen.getByText('Redmi Note 13 Pro')).toBeInTheDocument();
    expect(screen.getByText('Tk 18,999')).toBeInTheDocument();
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
    expect(screen.getByText('Service unavailable')).toBeInTheDocument();

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
    expect(screen.getByText('The chat service returned an unexpected response.')).toBeInTheDocument();
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

    supabaseState.authCallback?.('SIGNED_IN', { user: { id: 'user-1' } });

    await waitFor(() => {
      expect(screen.queryByText('hello')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Hi there! How can I help you today?')).toBeInTheDocument();
  });

  it('resets chat history after sign out', async () => {
    window.sessionStorage.setItem(
      'buysmart.buyer-chat-widget-messages',
      JSON.stringify([
        { id: 'assistant-greeting', role: 'assistant', text: 'Hi there! How can I help you today?' },
        { id: 'user-1', role: 'user', text: 'Need help' },
      ]),
    );
    window.sessionStorage.setItem(
      'buysmart.buyer-chat-widget-context',
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

    supabaseState.authCallback?.('SIGNED_OUT', null);

    await waitFor(() => {
      expect(screen.queryByText('Need help')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Hi there! How can I help you today?')).toBeInTheDocument();
  });

  it('does not restore guest chat history after a signed-in reload', async () => {
    supabaseState.user = { id: 'user-42' };

    window.sessionStorage.setItem(
      'buysmart.buyer-chat-widget-messages',
      JSON.stringify([
        { id: 'assistant-greeting', role: 'assistant', text: 'Hi there! How can I help you today?' },
        { id: 'guest-1', role: 'user', text: 'guest message' },
      ]),
    );
    window.sessionStorage.setItem(
      'buysmart.buyer-chat-widget-context',
      JSON.stringify({
        category: null,
        price_max: null,
        lastOrderId: null,
        history: [{ role: 'user', content: 'guest message' }],
      }),
    );
    window.sessionStorage.setItem('buysmart.buyer-chat-widget-auth-marker', 'guest');

    render(<BuyerChatbotWidget />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Open chat' }));

    await waitFor(() => {
      expect(screen.queryByText('guest message')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Hi there! How can I help you today?')).toBeInTheDocument();
  });
});
