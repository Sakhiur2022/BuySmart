import type {
  CreateFeedbackInput,
  Feedback,
  FeedbackListFilters,
  FeedbackListResult,
  FeedbackViewerScope,
  UpdateFeedbackInput,
  UserRole,
} from '@/lib/models/feedback.model';
import {
  createFeedback,
  fetchBuyerOrderById,
  fetchBuyerOrderItemById,
  fetchFeedbackById,
  fetchFeedbackListForScope,
  fetchLatestDeliveredOrderItemForBuyerProduct,
  fetchUserRole,
  isSellerOwnerOfProduct,
  softDeleteFeedbackById,
  updateFeedbackById,
} from '@/lib/repositories/feedback.repository';

const DELIVERED_ORDER_STATUSES = new Set(['delivered', 'completed']);
const DELIVERED_ORDER_ITEM_STATUS = 'delivered';
const VERIFIED_PURCHASE_REQUIRED = 'VERIFIED_PURCHASE_REQUIRED';

function normalizeUserId(userId: string): string {
  const normalized = userId.trim();
  if (!normalized) {
    throw new Error('User ID is required');
  }

  return normalized;
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeOptionalStringOrNull(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function ensureRatingRange(rating: number | undefined): number | undefined {
  if (rating === undefined) {
    return undefined;
  }

  const normalized = Math.trunc(rating);
  if (!Number.isFinite(normalized) || normalized < 1 || normalized > 5) {
    throw new Error('Invalid rating value');
  }

  return normalized;
}

async function resolveViewerScope(userId: string): Promise<FeedbackViewerScope> {
  const normalizedUserId = normalizeUserId(userId);
  const role = await fetchUserRole(normalizedUserId);

  if (!role) {
    throw new Error('UNAUTHENTICATED');
  }

  return {
    userId: normalizedUserId,
    role,
  };
}

function canModerate(role: UserRole): boolean {
  return role === 'admin' || role === 'moderator';
}

async function assertReadAccess(scope: FeedbackViewerScope, feedback: Feedback): Promise<void> {
  if (canModerate(scope.role)) {
    return;
  }

  if (scope.role === 'buyer') {
    if (feedback.user_id === scope.userId || feedback.status === 'published') {
      return;
    }

    throw new Error('FORBIDDEN');
  }

  if (scope.role === 'seller') {
    if (!feedback.product_id) {
      throw new Error('FORBIDDEN');
    }

    const ownsProduct = await isSellerOwnerOfProduct(scope.userId, feedback.product_id);
    if (!ownsProduct) {
      throw new Error('FORBIDDEN');
    }

    return;
  }

  throw new Error('FORBIDDEN');
}

function assertCanCreate(scope: FeedbackViewerScope): void {
  if (scope.role !== 'buyer' && scope.role !== 'seller') {
    throw new Error('FORBIDDEN');
  }
}

function assertCanMutate(scope: FeedbackViewerScope, feedback: Feedback): void {
  if (canModerate(scope.role)) {
    return;
  }

  if (scope.role === 'buyer' && feedback.user_id === scope.userId) {
    return;
  }

  throw new Error('FORBIDDEN');
}

function normalizeCreateInput(input: CreateFeedbackInput): CreateFeedbackInput {
  const title = normalizeOptionalString(input.title);
  const comment = normalizeOptionalString(input.comment);
  const rating = ensureRatingRange(input.rating);

  return {
    ...input,
    product_id: normalizeOptionalString(input.product_id),
    order_id: normalizeOptionalString(input.order_id),
    order_item_id: normalizeOptionalString(input.order_item_id),
    title,
    comment,
    rating,
    status: input.status ?? 'published',
  };
}

async function enforceVerifiedPurchaseForProductReview(
  buyerId: string,
  input: CreateFeedbackInput,
): Promise<CreateFeedbackInput> {
  if (input.feedback_type !== 'product_review') {
    return input;
  }

  if (!input.product_id) {
    throw new Error('product_id is required for product_review');
  }

  let resolvedOrderId = input.order_id;
  let resolvedOrderItemId = input.order_item_id;

  if (input.order_item_id) {
    const orderItem = await fetchBuyerOrderItemById(buyerId, input.order_item_id);
    if (!orderItem) {
      throw new Error(VERIFIED_PURCHASE_REQUIRED);
    }

    if (orderItem.status !== DELIVERED_ORDER_ITEM_STATUS) {
      throw new Error(VERIFIED_PURCHASE_REQUIRED);
    }

    if (!DELIVERED_ORDER_STATUSES.has(orderItem.order_status)) {
      throw new Error(VERIFIED_PURCHASE_REQUIRED);
    }

    if (orderItem.product_id !== input.product_id) {
      throw new Error(VERIFIED_PURCHASE_REQUIRED);
    }

    resolvedOrderId = orderItem.order_id;
    resolvedOrderItemId = orderItem.order_item_id;
  }

  if (input.order_id) {
    const order = await fetchBuyerOrderById(buyerId, input.order_id);
    if (!order) {
      throw new Error(VERIFIED_PURCHASE_REQUIRED);
    }

    if (!DELIVERED_ORDER_STATUSES.has(order.status)) {
      throw new Error(VERIFIED_PURCHASE_REQUIRED);
    }

    resolvedOrderId = order.order_id;
  }

  if (resolvedOrderItemId) {
    if (resolvedOrderId && resolvedOrderId !== input.order_id && input.order_id) {
      throw new Error(VERIFIED_PURCHASE_REQUIRED);
    }

    return {
      ...input,
      order_id: resolvedOrderId,
      order_item_id: resolvedOrderItemId,
      is_verified_purchase: true,
    };
  }

  const fallback = await fetchLatestDeliveredOrderItemForBuyerProduct(
    buyerId,
    input.product_id,
    resolvedOrderId,
  );

  if (!fallback) {
    throw new Error(VERIFIED_PURCHASE_REQUIRED);
  }

  return {
    ...input,
    order_id: fallback.order_id,
    order_item_id: fallback.order_item_id,
    is_verified_purchase: true,
  };
}

function normalizeUpdateInput(input: UpdateFeedbackInput): UpdateFeedbackInput {
  const normalized: UpdateFeedbackInput = {
    ...input,
    title: normalizeOptionalStringOrNull(input.title),
    comment: normalizeOptionalStringOrNull(input.comment),
    product_id: normalizeOptionalStringOrNull(input.product_id),
    order_id: normalizeOptionalStringOrNull(input.order_id),
    order_item_id: normalizeOptionalStringOrNull(input.order_item_id),
  };

  if (input.rating !== undefined) {
    if (input.rating === null) {
      normalized.rating = null;
    } else {
      normalized.rating = ensureRatingRange(input.rating);
    }
  }

  return normalized;
}

function validateListFilters(scope: FeedbackViewerScope, filters: FeedbackListFilters): void {
  if (
    filters.ratingMin !== undefined &&
    filters.ratingMax !== undefined &&
    filters.ratingMin > filters.ratingMax
  ) {
    throw new Error('Invalid rating range');
  }

  if (scope.role === 'buyer' && filters.userId && filters.userId !== scope.userId) {
    throw new Error('FORBIDDEN');
  }
}

export async function listFeedbackForScope(
  userId: string,
  filters: FeedbackListFilters,
): Promise<FeedbackListResult> {
  const scope = await resolveViewerScope(userId);
  validateListFilters(scope, filters);

  const { feedback, totalCount } = await fetchFeedbackListForScope(filters, scope);
  const totalPages = Math.max(1, Math.ceil(totalCount / filters.pageSize));

  return {
    feedback,
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      totalCount,
      totalPages,
    },
  };
}

export async function getFeedbackByIdForScope(
  userId: string,
  feedbackId: string,
): Promise<Feedback> {
  const scope = await resolveViewerScope(userId);
  const feedback = await fetchFeedbackById(feedbackId);

  if (!feedback) {
    throw new Error('Feedback not found');
  }

  await assertReadAccess(scope, feedback);
  return feedback;
}

export async function createFeedbackForUser(
  userId: string,
  input: CreateFeedbackInput,
): Promise<Feedback> {
  const scope = await resolveViewerScope(userId);
  assertCanCreate(scope);

  const normalized = normalizeCreateInput(input);
  if (!normalized.product_id && !normalized.order_id) {
    throw new Error('Either product_id or order_id is required');
  }

  const verified = await enforceVerifiedPurchaseForProductReview(scope.userId, normalized);

  return createFeedback(scope.userId, verified);
}

export async function updateFeedbackForScope(
  userId: string,
  feedbackId: string,
  input: UpdateFeedbackInput,
): Promise<Feedback> {
  const scope = await resolveViewerScope(userId);
  const existing = await fetchFeedbackById(feedbackId);

  if (!existing) {
    throw new Error('Feedback not found');
  }

  assertCanMutate(scope, existing);

  const normalized = normalizeUpdateInput(input);
  const hasChanges = Object.values(normalized).some((value) => value !== undefined);

  if (!hasChanges) {
    throw new Error('At least one field is required for update');
  }

  if (!canModerate(scope.role)) {
    if (normalized.status && normalized.status !== 'draft' && normalized.status !== 'published') {
      throw new Error('FORBIDDEN');
    }
  }

  return updateFeedbackById(feedbackId, normalized);
}

export async function softDeleteFeedbackForScope(
  userId: string,
  feedbackId: string,
): Promise<Feedback> {
  const scope = await resolveViewerScope(userId);
  const existing = await fetchFeedbackById(feedbackId);

  if (!existing) {
    throw new Error('Feedback not found');
  }

  assertCanMutate(scope, existing);
  const moderatorId = canModerate(scope.role) ? scope.userId : undefined;

  return softDeleteFeedbackById(feedbackId, moderatorId);
}
