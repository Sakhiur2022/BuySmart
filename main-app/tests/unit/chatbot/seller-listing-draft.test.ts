import { describe, expect, it } from 'vitest';

import {
  buildSellerListingIntentOutput,
  createEmptySellerListingDraft,
  extractSellerListingDraft,
  getSellerListingFieldSummary,
  getSellerListingMissingFields,
  getSellerListingPrompt,
} from '@/lib/chatbot/seller-listing-draft';

describe('seller listing draft helpers', () => {
  it('tracks the remaining fields for an empty draft', () => {
    const draft = createEmptySellerListingDraft();

    expect(getSellerListingMissingFields(draft)).toEqual([
      'name',
      'price',
      'category',
      'photos',
      'stockQuantity',
    ]);
    expect(getSellerListingPrompt(draft, [])).toBe('What is the product name?');
  });

  it('extracts a structured draft from one seller message', () => {
    const draft = extractSellerListingDraft(
      'Name: Wireless Mouse; price 1499; category: electronics; stock: 24; https://example.com/mouse.jpg',
      null,
    );

    expect(draft).toMatchObject({
      name: 'Wireless Mouse',
      price: 1499,
      category: 'electronics',
      stockQuantity: 24,
    });
    expect(draft.photos).toEqual(['https://example.com/mouse.jpg']);
  });

  it('builds the publish payload using backend-safe fields only', () => {
    const intent = buildSellerListingIntentOutput({
      name: 'Wireless Mouse',
      price: 1499,
      category: 'electronics',
      photos: ['https://example.com/mouse.jpg'],
      stockQuantity: 24,
    }, 'seller-123');

    expect(intent.intent).toBe('SELLER_LISTING_CREATE');
    expect(intent.payload).toEqual({
      name: 'Wireless Mouse',
      price: 1499,
      category: 'electronics',
      photos: ['https://example.com/mouse.jpg'],
      stockQuantity: 24,
    });
  });

  it('returns a readable field summary for the preview card', () => {
    const summary = getSellerListingFieldSummary({
      name: 'Wireless Mouse',
      price: 1499,
      category: 'electronics',
      photos: ['https://example.com/mouse.jpg'],
      stockQuantity: 24,
    });

    expect(summary.find((item) => item.field === 'name')?.ready).toBe(true);
    expect(summary.find((item) => item.field === 'photos')?.value).toBe(1);
  });
});
