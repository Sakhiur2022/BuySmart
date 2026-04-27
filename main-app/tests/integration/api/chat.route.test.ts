import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import { POST } from '@/app/api/chat/route';

describe('POST /api/chat', () => {
  it('guides buyers to the existing order history flow for status questions', async () => {
    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'How do I check my order status?',
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
    expect(body.intent).toBe('TRACK_ORDER');
    expect(body.reply).toBe('Tap Orders, then View details on the order.');
  });

  it('answers how to check or find order status with the exact UI flow', async () => {
    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'How do I find my order status?',
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
    expect(body.intent).toBe('TRACK_ORDER');
    expect(body.reply).toBe('Tap Orders, then View details on the order.');
  });

  it('guides buyers to the existing refund flow and dashboard status pages', async () => {
    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'How can I check my refund status?',
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
    expect(body.intent).toBe('REFUND_POLICY');
    expect(body.reply).toBe('Check Refund status and tap Details.');
    expect(body.policyText).toBeUndefined();
  });

  it('answers how to request a refund with the exact UI flow', async () => {
    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'How do I request a refund?',
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
    expect(body.intent).toBe('REFUND_POLICY');
    expect(body.reply).toBe('Tap Orders, then View details, then Request Refund.');
    expect(body.policyText).toBeUndefined();
  });

  it('still returns refund policy details when the user explicitly asks for policy', async () => {
    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'What is your refund policy?',
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
    expect(body.intent).toBe('REFUND_POLICY');
    expect(body.policyText).toContain('Tap Orders');
  });
});
