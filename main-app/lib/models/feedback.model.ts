import type { Database, Json } from '@/lib/types/database.types';

type FeedbackRow = Database['public']['Tables']['feedback']['Row'];

export type Feedback = FeedbackRow;
export type FeedbackType = Database['public']['Enums']['feedback_type_enum'];
export type FeedbackStatus = Database['public']['Enums']['feedback_status_enum'];
export type UserRole = Database['public']['Enums']['user_role_enum'];

export type FeedbackSortBy = 'recent' | 'oldest' | 'rating-high' | 'rating-low' | 'helpful';

export interface CreateFeedbackInput {
  feedback_type: FeedbackType;
  product_id?: string;
  order_id?: string;
  order_item_id?: string;
  rating?: number;
  title?: string;
  comment?: string;
  images?: Json;
  is_verified_purchase?: boolean;
  status?: FeedbackStatus;
}

export interface UpdateFeedbackInput {
  feedback_type?: FeedbackType;
  product_id?: string | null;
  order_id?: string | null;
  order_item_id?: string | null;
  rating?: number | null;
  title?: string | null;
  comment?: string | null;
  images?: Json | null;
  status?: FeedbackStatus;
}

export interface FeedbackListFilters {
  page: number;
  pageSize: number;
  productId?: string;
  orderId?: string;
  userId?: string;
  status?: FeedbackStatus;
  feedbackType?: FeedbackType;
  ratingMin?: number;
  ratingMax?: number;
  sortBy: FeedbackSortBy;
}

export interface FeedbackViewerScope {
  userId: string;
  role: UserRole;
}

export interface FeedbackListResult {
  feedback: Feedback[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}
