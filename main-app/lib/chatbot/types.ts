export type IntentType = 'PRODUCT_SEARCH' | 'TRACK_ORDER' | 'REFUND_POLICY' | 'FAQ' | 'SUPPORT';

export interface AIParams {
  category?: string;
  price_max?: number;
  price_min?: number;
  features?: string[];
  orderId?: string;
  query?: string;
}

export interface AIResponse {
  intent: IntentType;
  params: AIParams;
  reply: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  images: string[];
  stock_available: boolean;
  features: string[];
  badge?: string;
  emoji?: string;
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  created_at: string;
  items: OrderItem[];
  buyer_id: string;
}

export type MessageRole = 'user' | 'assistant';
export type ChatbotRole = 'buyer' | 'seller' | 'admin';

export interface ChatMessage {
  role: MessageRole;
  content: string;
}

export interface UIMessage {
  id: string;
  role: MessageRole;
  text: string;
  createdAt?: number;
  status?: 'streaming' | 'error';
  errorMessage?: string;
  retryable?: boolean;
  products?: Product[];
  order?: Order;
  policyText?: string;
  isEscalation?: boolean;
}

export interface ChatContext {
  category: string | null;
  price_max: number | null;
  lastOrderId: string | null;
  history: ChatMessage[];
}

export interface ChatAPIRequest {
  message: string;
  role?: ChatbotRole;
  context: ChatContext;
  userId?: string;
  intentOutput?: unknown;
  recommendationContext?: {
    candidates: Array<{
      id: string;
      title: string;
      category_id?: number;
      brand?: string;
      price?: number;
      image?: string;
      tags?: string[];
    }>;
    contextSummary?: string;
    maxResults?: number;
  };
}

export interface ChatAPIResponse {
  reply: string;
  intent: IntentType;
  products?: Product[];
  order?: Order;
  policyText?: string;
  isEscalation?: boolean;
  updatedContext: ChatContext;
  intentResolution?: {
    success: boolean;
    intent?: import('@/lib/chatbot/buyer-intent/types').BuyerIntent;
    error?: import('@/lib/chatbot/buyer-intent/errors').BuyerIntentError;
  };
  toolCall?: import('@/lib/chatbot/buyer-intent/facade').BuyerToolCall;
  toolError?: import('@/lib/chatbot/buyer-intent/errors').BuyerIntentError;
  toolResult?: unknown;
  refundReferenceId?: string;
}
