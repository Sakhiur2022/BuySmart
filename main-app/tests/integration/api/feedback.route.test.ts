import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/app/api/cart/_shared', () => ({
  requireAuthenticatedUser: vi.fn(),
}));

vi.mock('@/lib/controllers/feedback.controller', () => ({
  createFeedback: vi.fn(),
  getFeedbackList: vi.fn(),
}));

import { requireAuthenticatedUser } from '@/app/api/cart/_shared';
import { createFeedback } from '@/lib/controllers/feedback.controller';
import { POST } from '@/app/api/feedback/route';

describe('POST /api/feedback', () => {
  it('returns 201 and stable envelope when creation succeeds with submit-time sentiment result', async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({ userId: 'user-test-1' });
    vi.mocked(createFeedback).mockResolvedValue({
      feedback_id: '84213b38-4a50-4b68-bc3d-b2ba3fdc6f5d',
      feedback_type: 'product_review',
      product_id: '2f4e0c7b-9639-45ce-9e47-4711236a2bca',
      title: 'Great product',
      comment: 'Delivery was quick and quality is excellent.',
      ai_sentiment: 'positive',
      ai_confidence_score: 0.91,
      ai_category: 'product_quality',
      ai_urgency: 'low',
      ai_keywords: ['great quality', 'quick delivery'],
      ai_processed_at: '2026-04-18T00:00:00.000Z',
    } as never);

    const req = new NextRequest('http://localhost/api/feedback', {
      method: 'POST',
      body: JSON.stringify({
        feedback_type: 'product_review',
        product_id: '2f4e0c7b-9639-45ce-9e47-4711236a2bca',
        title: 'Great product',
        comment: 'Delivery was quick and quality is excellent.',
      }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(createFeedback).toHaveBeenCalledWith('user-test-1', {
      feedback_type: 'product_review',
      product_id: '2f4e0c7b-9639-45ce-9e47-4711236a2bca',
      title: 'Great product',
      comment: 'Delivery was quick and quality is excellent.',
    });
    expect(body.feedback.feedback_id).toBe('84213b38-4a50-4b68-bc3d-b2ba3fdc6f5d');
    expect(body.feedback.ai_sentiment).toBe('positive');
  });

  it('returns 400 for invalid JSON payload', async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({ userId: 'user-test-1' });

    const req = new NextRequest('http://localhost/api/feedback', {
      method: 'POST',
      body: '{ invalid-json',
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid JSON payload');
  });

  it('returns 400 when payload validation fails', async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({ userId: 'user-test-1' });

    const req = new NextRequest('http://localhost/api/feedback', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Missing feedback type',
      }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Validation failed');
  });

  it('returns 401 for unauthenticated requests', async () => {
    vi.mocked(requireAuthenticatedUser).mockRejectedValue(new Error('UNAUTHENTICATED'));

    const req = new NextRequest('http://localhost/api/feedback', {
      method: 'POST',
      body: JSON.stringify({
        feedback_type: 'general_feedback',
        order_id: 'a8ce9cc2-6f38-4f2b-a6fa-fb1f910eeff6',
      }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized: Not authenticated');
  });
});
