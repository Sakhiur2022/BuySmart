/** @vitest-environment jsdom */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatbotWidget from '@/components/shared/chatbot-widget';
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
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [{ category_id: 1, name: 'Electronics' }],
            error: null,
          }),
        }),
      }),
    }),
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

vi.mock('@/lib/actions/products', () => ({
  createProductAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('next/image', () => ({
  default: ({ fill, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => {
    void fill;
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} alt={props.alt} />;
  },
}));

if (!Element.prototype.hasPointerCapture) {
  Object.defineProperty(Element.prototype, 'hasPointerCapture', {
    value: () => false,
  });
}

if (!Element.prototype.setPointerCapture) {
  Object.defineProperty(Element.prototype, 'setPointerCapture', {
    value: () => undefined,
  });
}

if (!Element.prototype.releasePointerCapture) {
  Object.defineProperty(Element.prototype, 'releasePointerCapture', {
    value: () => undefined,
  });
}

if (!Element.prototype.scrollIntoView) {
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    value: () => undefined,
  });
}

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

  it('prefers seller routing on seller routes even if the widget starts in buyer mode', async () => {
    pathnameState.value = '/seller';

    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        intent: 'FAQ',
        reply: 'Here is your seller summary.',
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

    render(<ChatbotWidget chatbotRole="buyer" />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Open chat' }));

    expect(screen.getByText('Hello! I can help you manage listings, orders, and inventory.')).toBeInTheDocument();

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
  });

  it('renders an editable inline product form for seller listing drafts', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        intent: 'FAQ',
        reply: 'Let us create a product draft.',
        updatedContext: {
          category: null,
          price_max: null,
          lastOrderId: null,
          history: [
            { role: 'user', content: 'Add a new product' },
            { role: 'assistant', content: 'Let us create a product draft.' },
          ],
        },
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

    render(<SellerChatbotWidget />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Open chat' }));
    await user.type(screen.getByLabelText('Type a message'), 'Add a new product');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    const productNameInput = await screen.findByLabelText('Product Name');
    await user.clear(productNameInput);
    await user.type(productNameInput, 'Wireless Mouse Pro');

    expect(productNameInput).toHaveValue('Wireless Mouse Pro');
    expect(screen.getByRole('button', { name: 'Create Product' })).toBeInTheDocument();
  });

  it('locks the inline product form after publish', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        intent: 'FAQ',
        reply: 'Your product was published.',
        toolCall: {
          toolName: 'seller_listing_create',
          input: {},
        },
        toolResult: {
          listing: {
            name: 'Wireless Mouse Pro',
            price: 1299,
            category: 'Electronics',
            photos: ['https://example.com/p1.jpg'],
            stockQuantity: 5,
          },
        },
        updatedContext: {
          category: null,
          price_max: null,
          lastOrderId: null,
          history: [
            { role: 'user', content: 'Publish this listing.' },
            { role: 'assistant', content: 'Your product was published.' },
          ],
        },
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

    render(<SellerChatbotWidget />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Open chat' }));
    await user.type(screen.getByLabelText('Type a message'), 'Add a new product');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    const productNameInput = await screen.findByLabelText('Product Name');
    await user.clear(productNameInput);
    await user.type(productNameInput, 'Wireless Mouse Pro');
    await user.clear(screen.getByLabelText('Price (BDT)'));
    await user.type(screen.getByLabelText('Price (BDT)'), '1299');
    await user.clear(screen.getByLabelText('Stock'));
    await user.type(screen.getByLabelText('Stock'), '5');
    await user.click(screen.getByRole('combobox', { name: 'Category' }));
    await user.click(await screen.findByRole('option', { name: 'Electronics' }));
    await user.click(screen.getByRole('button', { name: 'Create Product' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Published' })).toBeDisabled();
      expect(productNameInput).toBeDisabled();
      expect(screen.getByRole('combobox', { name: 'Category' })).toBeDisabled();
    });
  });
});