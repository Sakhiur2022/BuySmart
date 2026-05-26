import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { createGroqCompletionChainMock, mockGroqChainSuccess } from '@/tests/mocks/langchain';

vi.mock('@/lib/services/ai/langchain-groq', () => ({
  createGroqCompletionChain: vi.fn(() => createGroqCompletionChainMock()),
}));

vi.mock('@/lib/chatbot/support-ai', () => ({
  answerSupportQuestion: vi.fn(),
  answerProductSearchQuestion: vi.fn(),
}));

vi.mock('@/app/api/cart/_shared', () => ({
  requireAuthenticatedUser: vi.fn(async () => ({ userId: 'user-1' })),
}));

vi.mock('@/lib/controllers/refund.controller', () => ({
  createRefund: vi.fn(async () => ({
    refund_id: 'c0e2a9e2-5f6c-4a2b-a3a2-9c1b657fe7c0',
    refund_number: 'RFD-20260523-ABC123',
    order_id: '2c1cf3c0-7e6b-4e0e-8e78-8f3d1a53a822',
    status: 'pending',
    requested_amount: 55.5,
    created_at: new Date().toISOString(),
  })),
}));

import { POST } from '@/app/api/buyer/chat/route';
import { requireAuthenticatedUser } from '@/app/api/cart/_shared';
import { answerProductSearchQuestion, answerSupportQuestion } from '@/lib/chatbot/support-ai';

describe('POST /api/buyer/chat', () => {
  it('returns 400 for invalid JSON payload', async () => {
    const req = new NextRequest('http://localhost/api/buyer/chat', {
      method: 'POST',
      body: '{ invalid-json',
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid JSON payload.');
  });

  it('returns 401 for unauthenticated requests', async () => {
    vi.mocked(requireAuthenticatedUser).mockRejectedValueOnce(new Error('UNAUTHENTICATED'));

    const req = new NextRequest('http://localhost/api/buyer/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'How does checkout work?',
      }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized: Not authenticated');
  });

  it('uses the AI support layer for general buyer questions', async () => {
    vi.mocked(answerSupportQuestion).mockResolvedValue({
      reply: 'Use Add to Cart first, then open Your Cart and tap Checkout.',
      shouldEscalate: false,
    });

    const req = new NextRequest('http://localhost/api/buyer/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'How does checkout work?',
        context: {
          category: null,
          price_max: null,
          lastOrderId: null,
          history: [],
        },
      }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.intent).toBe('FAQ');
    expect(body.reply).toBe('Use Add to Cart first, then open Your Cart and tap Checkout.');
  });

  it('validates refund intent and invokes refund tool', async () => {
    const req = new NextRequest('http://localhost/api/buyer/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Refund my last order',
        context: {
          category: null,
          price_max: null,
          lastOrderId: null,
          history: [],
        },
        intentOutput: {
          intent: 'REFUND_REQUEST',
          payload: {
            orderSignal: { orderId: '2c1cf3c0-7e6b-4e0e-8e78-8f3d1a53a822' },
            reason: 'damage',
            requestedAmount: 55.5,
          },
        },
      }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.intentResolution?.success).toBe(true);
    expect(body.toolCall?.toolName).toBe('refund_request');
    expect(body.toolResult?.refund?.refund_number).toBe('RFD-20260523-ABC123');
    expect(body.refundReferenceId).toBe('RFD-20260523-ABC123');
  });

  it('validates recommendation intent and invokes recommendation tool', async () => {
    mockGroqChainSuccess(
      JSON.stringify({
        summary: 'Top picks for your request.',
        recommendations: [
          {
            productId: 'p1',
            title: 'Glow Kit',
            reason: 'Matches skincare preference',
            score: 0.92,
          },
        ],
      }),
    );

    vi.mocked(answerProductSearchQuestion).mockResolvedValue({
      reply: 'Here are a few picks to consider.',
    });
    vi.mocked(answerSupportQuestion).mockResolvedValue({
      reply: 'Let me help with that.',
      shouldEscalate: false,
    });

    const req = new NextRequest('http://localhost/api/buyer/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'gift for my wife',
        context: {
          category: null,
          price_max: null,
          lastOrderId: null,
          history: [],
        },
        intentOutput: {
          intent: 'PRODUCT_RECOMMENDATION',
          payload: {
            occasion: 'gift',
            attributes: ['skincare'],
          },
        },
        recommendationContext: {
          candidates: [
            {
              id: 'p1',
              title: 'Glow Kit',
              price: 45,
            },
          ],
          maxResults: 3,
        },
      }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.intentResolution?.success).toBe(true);
    expect(body.toolCall?.toolName).toBe('product_recommendation');
    expect(body.toolResult?.summary).toBe('Top picks for your request.');
    expect(body.toolResult?.recommendations?.length).toBe(1);
  });
});
