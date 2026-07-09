/** @vitest-environment jsdom */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SellerChatbotWidget from '@/components/shared/seller-chatbot-widget';

const pathnameState = vi.hoisted(() => ({
  value: '/seller',
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

describe('SellerChatbotWidget', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    pathnameState.value = '/seller';
    supabaseState.user = { id: 'seller-123' };
    supabaseState.authCallback = null;
    supabaseState.unsubscribe.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a seller sales summary card and approves pending refunds in chat', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        intent: 'FAQ',
        reply: 'Here is your seller summary.',
        toolCall: {
          toolName: 'seller_sales_summary',
          input: { timeframe: 'CURRENT_WEEK' },
        },
        toolResult: {
          totalItemsSold: 18,
          totalRevenue: 42500,
          topProduct: {
            product_id: 'p2',
            name: 'Realme Narzo 60',
            itemsSold: 7,
          },
          pendingRefundCount: 3,
        },
        updatedContext: {
          category: null,
          price_max: null,
          lastOrderId: null,
          history: [
            { role: 'user', content: 'How are my sales this week?' },
            { role: 'assistant', content: 'Here is your seller summary.' },
          ],
        },
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

    render(<SellerChatbotWidget />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Open chat' }));
    await user.type(screen.getByLabelText('Type a message'), 'How are my sales this week?');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/seller/chat',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    const summaryCard = screen.getByText('Pending refunds').closest('[data-slot="card"]') as HTMLElement | null;
    expect(summaryCard).toBeTruthy();
    expect(within(summaryCard!).getByRole('button', { name: 'Approve all refunds' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Type a message'), 'approve all refunds');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(await screen.findByText('Approved 3 pending refunds in chat.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All refunds approved' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});