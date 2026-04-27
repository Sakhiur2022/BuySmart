import type { AIParams, Order, Product } from './types';

export const MOCK_PRODUCTS: Product[] = [
  {
    id: 'p1',
    name: 'Redmi Note 13 Pro',
    price: 18999,
    category: 'phone',
    images: [],
    stock_available: true,
    features: ['gaming', 'battery', 'camera'],
    badge: 'Best battery',
    emoji: 'phone',
  },
  {
    id: 'p2',
    name: 'Realme Narzo 60',
    price: 17500,
    category: 'phone',
    images: [],
    stock_available: true,
    features: ['gaming', 'fast-charge'],
    badge: 'Gaming pick',
    emoji: 'phone',
  },
  {
    id: 'p3',
    name: 'Poco X6 Neo',
    price: 19500,
    category: 'phone',
    images: [],
    stock_available: true,
    features: ['display', 'gaming'],
    badge: '120Hz display',
    emoji: 'phone',
  },
  {
    id: 'p4',
    name: 'Samsung Galaxy M34',
    price: 20000,
    category: 'phone',
    images: [],
    stock_available: true,
    features: ['battery', 'camera'],
    badge: '6000mAh',
    emoji: 'phone',
  },
  {
    id: 'p5',
    name: 'HP Victus 15',
    price: 58000,
    category: 'laptop',
    images: [],
    stock_available: true,
    features: ['gaming', 'gpu'],
    badge: 'GTX 1650',
    emoji: 'laptop',
  },
  {
    id: 'p6',
    name: 'Lenovo IdeaPad Gaming 3',
    price: 55000,
    category: 'laptop',
    images: [],
    stock_available: true,
    features: ['gaming', 'performance'],
    badge: 'Ryzen 5',
    emoji: 'laptop',
  },
  {
    id: 'p7',
    name: 'Samsung Galaxy Tab A9',
    price: 22000,
    category: 'tablet',
    images: [],
    stock_available: true,
    features: ['display', 'battery'],
    badge: '11-inch',
    emoji: 'tablet',
  },
  {
    id: 'p8',
    name: 'Realme Pad 2',
    price: 18000,
    category: 'tablet',
    images: [],
    stock_available: true,
    features: ['battery'],
    badge: '8800mAh',
    emoji: 'tablet',
  },
  {
    id: 'p9',
    name: 'Sony WH-1000XM5',
    price: 35000,
    category: 'headphone',
    images: [],
    stock_available: true,
    features: ['noise-cancel', 'battery'],
    badge: 'ANC',
    emoji: 'headphone',
  },
  {
    id: 'p10',
    name: 'JBL Tune 760NC',
    price: 8500,
    category: 'headphone',
    images: [],
    stock_available: true,
    features: ['noise-cancel'],
    badge: '50hr battery',
    emoji: 'headphone',
  },
];

export const MOCK_ORDER: Order = {
  id: 'ORD-4821',
  status: 'shipped',
  created_at: '2026-04-24T10:30:00Z',
  buyer_id: 'user_demo',
  items: [{ id: 'i1', name: 'Samsung Galaxy M34 5G', quantity: 1, price: 20000 }],
};

export const MOCK_POLICY = `You can request a refund within 7 days of delivery for any defective or wrong item.
Tap Orders, open View details for the order, and use Request Refund.
After submission, check the latest refund progress in Refund status and tap Details.
Approved refunds are typically processed within 3-5 business days to the original payment method.`;

export function mockSearchProducts(params: AIParams): Product[] {
  let results = MOCK_PRODUCTS;

  if (params.category) {
    results = results.filter((product) =>
      product.category.toLowerCase().includes(params.category!.toLowerCase()),
    );
  }

  if (params.price_max) {
    results = results.filter((product) => product.price <= params.price_max!);
  }

  if (params.price_min) {
    results = results.filter((product) => product.price >= params.price_min!);
  }

  if (params.features && params.features.length > 0) {
    results = results.filter((product) =>
      params.features!.some((feature) => product.features.includes(feature)),
    );
  }

  return results.slice(0, 4);
}

export function mockGetOrder(_orderId: string): Order {
  return MOCK_ORDER;
}
