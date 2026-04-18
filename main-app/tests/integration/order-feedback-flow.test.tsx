/** @vitest-environment jsdom */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OrderDetailView } from '@/components/orders/order-detail-view';

describe('Order to feedback navigation flow', () => {
  it('renders Leave Feedback link with order and orderItem query params', () => {
    render(
      <OrderDetailView
        order={
          {
            order_id: 'ord-1',
            order_number: 'ORD-0001',
            status: 'delivered',
            payment_status: 'paid',
            created_at: '2026-04-15T00:00:00.000Z',
            updated_at: '2026-04-15T00:00:00.000Z',
            shipped_at: '2026-04-16T00:00:00.000Z',
            delivered_at: '2026-04-17T00:00:00.000Z',
            completed_at: null,
            subtotal: 120,
            shipping_amount: 20,
            tax_amount: 0,
            discount_amount: 0,
            total_amount: 140,
            currency: 'BDT',
            shipping_address: {
              full_name: 'Sakhiur Rahman',
              phone: '+8801712345678',
              address_line_1: 'Dhaka',
              city: 'Dhaka',
              country: 'BD',
            },
            notes: null,
            billing_address: null,
          } as never
        }
        items={
          [
            {
              order_item_id: 'item-1',
              order_id: 'ord-1',
              product_id: 'prod-1',
              seller_id: 'seller-1',
              quantity: 1,
              unit_price: 120,
              total_price: 120,
              status: 'delivered',
              created_at: '2026-04-15T00:00:00.000Z',
              updated_at: '2026-04-15T00:00:00.000Z',
              product_snapshot: {
                name: 'Demo Product',
                short_description: 'Test item',
                image: null,
              },
            },
          ] as never
        }
        feedbackByOrderItemId={{}}
      />,
    );

    const leaveFeedback = screen.getByRole('link', { name: /leave feedback/i });
    expect(leaveFeedback).toHaveAttribute(
      'href',
      '/buyer/products/prod-1?leaveFeedback=1&orderId=ord-1&orderItemId=item-1#reviews',
    );
  });

  it('renders Edit Feedback when feedback already exists for the order item', () => {
    render(
      <OrderDetailView
        order={
          {
            order_id: 'ord-1',
            order_number: 'ORD-0001',
            status: 'delivered',
            payment_status: 'paid',
            created_at: '2026-04-15T00:00:00.000Z',
            updated_at: '2026-04-15T00:00:00.000Z',
            shipped_at: '2026-04-16T00:00:00.000Z',
            delivered_at: '2026-04-17T00:00:00.000Z',
            completed_at: null,
            subtotal: 120,
            shipping_amount: 20,
            tax_amount: 0,
            discount_amount: 0,
            total_amount: 140,
            currency: 'BDT',
            shipping_address: {
              full_name: 'Sakhiur Rahman',
              phone: '+8801712345678',
              address_line_1: 'Dhaka',
              city: 'Dhaka',
              country: 'BD',
            },
            notes: null,
            billing_address: null,
          } as never
        }
        items={
          [
            {
              order_item_id: 'item-1',
              order_id: 'ord-1',
              product_id: 'prod-1',
              seller_id: 'seller-1',
              quantity: 1,
              unit_price: 120,
              total_price: 120,
              status: 'delivered',
              created_at: '2026-04-15T00:00:00.000Z',
              updated_at: '2026-04-15T00:00:00.000Z',
              product_snapshot: {
                name: 'Demo Product',
                short_description: 'Test item',
                image: null,
              },
            },
          ] as never
        }
        feedbackByOrderItemId={{
          'item-1': {
            feedback_id: 'fb-1',
            status: 'published',
          },
        }}
      />,
    );

    const editFeedback = screen.getByRole('link', { name: /edit feedback/i });
    expect(editFeedback).toHaveAttribute(
      'href',
      '/buyer/products/prod-1?editFeedback=1&feedbackId=fb-1#reviews',
    );
  });
});
