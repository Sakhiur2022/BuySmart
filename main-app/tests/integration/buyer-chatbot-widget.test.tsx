/** @vitest-environment jsdom */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BuyerChatbotWidget from '@/components/shared/buyer-chatbot-widget';

const pathnameState = vi.hoisted(() => ({
  value: '/buyer',
}));

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameState.value,
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
});
