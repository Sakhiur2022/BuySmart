import type {
  ApproveRefundDecisionDTO,
  CreateRefundDTO,
  RejectRefundDecisionDTO,
  RefundDetailDTO,
  RefundFilterDTO,
  RefundListResponseDTO,
  RefundRepositoryFilterDTO,
  RefundResponseDTO,
  ReviewRefundDecisionDTO,
  RefundStatusTransitionDTO,
  UpdateRefundDTO,
} from '@/lib/types/refund.types';
import type { Database } from '@/lib/types/database.types';
import type {
  RefundEligibilitySnapshotDTO,
  IRefundRepository,
} from '@/lib/repositories/refund.repository';
import { RefundRepository } from '@/lib/repositories/refundRepository';
import {
  createRefundReadAccessStrategyRegistry,
  type RefundReadAccessStrategyRegistry,
} from '@/lib/strategies/refund-read-access/refund-read-access-strategy-registry';
import {
  analyzeRefundForCreatedRefund,
  enrichRefundSummaryWithAIAnalysis,
} from '@/lib/services/refund-analysis.service';
import { getRefundRecommendation } from '@/lib/services/refund-decision-adapter.service';
import {
  mapRecommendationToPersistence,
  maskRefundDetailForRole,
  maskRefundSummaryForRole,
} from '@/lib/repositories/refund-ai-recommendation.mapper';

type OrderStatus = Database['public']['Enums']['order_status_enum'];
type PaymentStatus = Database['public']['Enums']['payment_status_enum'];
type UserRole = Database['public']['Enums']['user_role_enum'];
type RefundStatus = Database['public']['Enums']['refund_status_enum'];

const ELIGIBLE_ORDER_STATUSES: ReadonlySet<OrderStatus> = new Set(['delivered', 'completed']);
const ELIGIBLE_PAYMENT_STATUSES: ReadonlySet<PaymentStatus> = new Set(['paid']);
const DECISION_TARGETS = {
  approve: 'approved',
  reject: 'rejected',
  review: 'manual_review',
} as const;

const LEGAL_DECISION_TRANSITIONS: Readonly<Record<RefundStatus, ReadonlySet<RefundStatus>>> = {
  pending: new Set(['approved', 'rejected', 'manual_review']),
  ai_review: new Set(['approved', 'rejected', 'manual_review']),
  manual_review: new Set(['approved', 'rejected']),
  approved: new Set(),
  processing: new Set(),
  completed: new Set(),
  rejected: new Set(),
  cancelled: new Set(),
};

export class RefundIneligibleStatusError extends Error {
  public readonly code = 'REFUND_INELIGIBLE_STATUS';
  public readonly orderStatus: OrderStatus;

  public constructor(orderStatus: OrderStatus) {
    super(`Refund not allowed for order status: ${orderStatus}`);
    this.name = 'RefundIneligibleStatusError';
    this.orderStatus = orderStatus;
  }
}

export class RefundIneligiblePaymentStatusError extends Error {
  public readonly code = 'REFUND_INELIGIBLE_PAYMENT_STATUS';
  public readonly paymentStatus: PaymentStatus;

  public constructor(paymentStatus: PaymentStatus) {
    super(`Refund not allowed for payment status: ${paymentStatus}`);
    this.name = 'RefundIneligiblePaymentStatusError';
    this.paymentStatus = paymentStatus;
  }
}

export class RefundInvalidAmountError extends Error {
  public readonly code = 'REFUND_INVALID_AMOUNT';

  public constructor(message: string) {
    super(message);
    this.name = 'RefundInvalidAmountError';
  }
}

export class RefundInvalidDecisionTransitionError extends Error {
  public readonly code = 'REFUND_INVALID_DECISION_TRANSITION';

  public constructor(fromStatus: RefundStatus, toStatus: RefundStatus) {
    super(`Refund cannot transition from ${fromStatus} to ${toStatus}`);
    this.name = 'RefundInvalidDecisionTransitionError';
  }
}

export class RefundInvalidDecisionPayloadError extends Error {
  public readonly code = 'REFUND_INVALID_DECISION_PAYLOAD';

  public constructor(message: string) {
    super(message);
    this.name = 'RefundInvalidDecisionPayloadError';
  }
}

function normalizeUserId(userId: string): string {
  const normalized = userId.trim();
  if (!normalized) {
    throw new Error('User ID is required');
  }

  return normalized;
}

function ensureRequestedAmountIsValid(amount: number): number {
  if (!Number.isFinite(amount)) {
    throw new RefundInvalidAmountError('Requested refund amount must be a valid number');
  }

  const rounded = Number(amount.toFixed(2));
  if (rounded <= 0) {
    throw new RefundInvalidAmountError('Requested refund amount must be greater than zero');
  }

  return rounded;
}

function buildRefundNumber(now: Date = new Date()): string {
  const stamp = now
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `RFD-${stamp}-${suffix}`;
}

type RefundActor = {
  userId: string;
  role: UserRole;
};

function assertRefundOwnership(userId: string, refund: RefundResponseDTO | RefundDetailDTO): void {
  if (refund.user_id !== userId) {
    throw new Error('FORBIDDEN');
  }
}

function toBuyerScopedListFilters(
  userId: string,
  filters: RefundFilterDTO,
): RefundRepositoryFilterDTO {
  return {
    ...filters,
    buyer_id: userId,
    seller_id: undefined,
  };
}

function assertEligibleOrderStatus(snapshot: RefundEligibilitySnapshotDTO): void {
  if (!ELIGIBLE_ORDER_STATUSES.has(snapshot.order_status)) {
    throw new RefundIneligibleStatusError(snapshot.order_status);
  }
}

function assertEligiblePaymentStatus(snapshot: RefundEligibilitySnapshotDTO): void {
  if (!ELIGIBLE_PAYMENT_STATUSES.has(snapshot.payment_status)) {
    throw new RefundIneligiblePaymentStatusError(snapshot.payment_status);
  }
}

function assertAmountWithinRemainingBalance(
  requestedAmount: number,
  remainingBalance: number,
): void {
  const normalizedRemaining = Number(remainingBalance.toFixed(2));

  if (requestedAmount > normalizedRemaining) {
    throw new RefundInvalidAmountError(
      `Requested refund amount exceeds remaining refundable balance (${normalizedRemaining.toFixed(2)})`,
    );
  }
}

async function resolveActor(
  refundRepository: IRefundRepository,
  userId: string,
): Promise<RefundActor> {
  const role = await refundRepository.getUserRole(userId);

  if (!role) {
    throw new Error('FORBIDDEN');
  }

  return { userId, role };
}

function toScopedListFilters(
  actor: RefundActor,
  filters: RefundFilterDTO,
): RefundRepositoryFilterDTO {
  if (actor.role === 'buyer') {
    return {
      ...filters,
      buyer_id: actor.userId,
      seller_id: undefined,
    };
  }

  if (actor.role === 'seller') {
    return {
      ...filters,
      buyer_id: undefined,
      seller_id: actor.userId,
    };
  }

  if (actor.role === 'admin') {
    return {
      ...filters,
      buyer_id: undefined,
      seller_id: undefined,
    };
  }

  throw new Error('FORBIDDEN');
}

function assertAdminActor(actor: RefundActor): void {
  if (actor.role !== 'admin') {
    throw new Error('FORBIDDEN');
  }
}

function assertLegalDecisionTransition(fromStatus: RefundStatus, toStatus: RefundStatus): void {
  const allowed = LEGAL_DECISION_TRANSITIONS[fromStatus];
  if (!allowed || !allowed.has(toStatus)) {
    throw new RefundInvalidDecisionTransitionError(fromStatus, toStatus);
  }
}

function buildProcessingNotes(input: {
  decision: keyof typeof DECISION_TARGETS;
  previousStatus: RefundStatus;
  note?: string;
}): string {
  const normalizedNote = input.note?.trim() || null;
  const notes = JSON.stringify({
    decision: input.decision,
    previous_status: input.previousStatus,
    note: normalizedNote,
  });

  if (notes.length > 2000) {
    throw new RefundInvalidDecisionPayloadError('Decision notes exceed maximum allowed length');
  }

  return notes;
}

async function applyDecisionCommand(input: {
  refundRepository: IRefundRepository;
  adminUserId: string;
  refundId: string;
  decision: keyof typeof DECISION_TARGETS;
  note?: string;
}): Promise<RefundResponseDTO> {
  const adminActor = await resolveActor(input.refundRepository, input.adminUserId);
  assertAdminActor(adminActor);

  const existing = await input.refundRepository.findById(input.refundId);
  if (!existing) {
    throw new Error('Refund not found');
  }

  const nextStatus = DECISION_TARGETS[input.decision];
  assertLegalDecisionTransition(existing.status, nextStatus);

  const updated = await input.refundRepository.applyDecision({
    refundId: input.refundId,
    fromStatus: existing.status,
    toStatus: nextStatus,
    processedBy: adminActor.userId,
    processedAt: new Date().toISOString(),
    processingNotes: buildProcessingNotes({
      decision: input.decision,
      previousStatus: existing.status,
      note: input.note,
    }),
  });

  if (!updated) {
    throw new Error('REFUND_CONFLICT');
  }

  return updated;
}

export class RefundService implements IRefundService {
  private readonly refundReadAccessStrategyRegistry: RefundReadAccessStrategyRegistry;

  public constructor(
    private readonly refundRepository: IRefundRepository = new RefundRepository(),
    refundReadAccessStrategyRegistry?: RefundReadAccessStrategyRegistry,
  ) {
    this.refundReadAccessStrategyRegistry =
      refundReadAccessStrategyRegistry ?? createRefundReadAccessStrategyRegistry();
  }

  public async getRefundById(userId: string, refundId: string): Promise<RefundResponseDTO> {
    const normalizedUserId = normalizeUserId(userId);
    const refund = await this.refundRepository.findById(refundId);

    if (!refund) {
      throw new Error('Refund not found');
    }

    assertRefundOwnership(normalizedUserId, refund);
    return refund;
  }

  public async getRefundDetail(userId: string, refundId: string): Promise<RefundDetailDTO> {
    const normalizedUserId = normalizeUserId(userId);
    const actor = await resolveActor(this.refundRepository, normalizedUserId);
    const refund = await this.refundRepository.findDetailById(refundId);

    if (!refund) {
      throw new Error('Refund not found');
    }

    const strategy = this.refundReadAccessStrategyRegistry.getForRole(actor.role);
    await strategy.assertCanRead(actor, { refund }, this.refundRepository);

    return maskRefundDetailForRole(refund, actor.role);
  }

  public async getBuyerRefundDetail(userId: string, refundId: string): Promise<RefundDetailDTO> {
    const normalizedUserId = normalizeUserId(userId);
    const refund = await this.refundRepository.findDetailById(refundId);

    if (!refund) {
      throw new Error('Refund not found');
    }

    assertRefundOwnership(normalizedUserId, refund);
    return maskRefundDetailForRole(refund, 'buyer');
  }

  public async listRefunds(
    userId: string,
    filters: RefundFilterDTO,
  ): Promise<RefundListResponseDTO> {
    const normalizedUserId = normalizeUserId(userId);
    const actor = await resolveActor(this.refundRepository, normalizedUserId);
    const result = await this.refundRepository.list(toScopedListFilters(actor, filters));

    return {
      ...result,
      refunds: result.refunds.map((refund) => {
        const enriched = enrichRefundSummaryWithAIAnalysis(refund);
        return maskRefundSummaryForRole(enriched, actor.role);
      }),
    };
  }

  public async listBuyerRefunds(
    userId: string,
    filters: RefundFilterDTO,
  ): Promise<RefundListResponseDTO> {
    const normalizedUserId = normalizeUserId(userId);
    const result = await this.refundRepository.list(
      toBuyerScopedListFilters(normalizedUserId, filters),
    );

    return {
      ...result,
      refunds: result.refunds.map((refund) => {
        const enriched = enrichRefundSummaryWithAIAnalysis(refund);
        return maskRefundSummaryForRole(enriched, 'buyer');
      }),
    };
  }

  public async createRefund(userId: string, input: CreateRefundDTO): Promise<RefundResponseDTO> {
    const normalizedUserId = normalizeUserId(userId);
    const actor = await resolveActor(this.refundRepository, normalizedUserId);

    if (actor.role !== 'buyer') {
      throw new Error('FORBIDDEN');
    }

    const requestedAmount = ensureRequestedAmountIsValid(input.requested_amount);
    const snapshot = await this.refundRepository.getEligibilitySnapshot({
      orderId: input.order_id,
      buyerId: normalizedUserId,
    });

    if (!snapshot) {
      throw new Error('Order not found');
    }

    assertEligibleOrderStatus(snapshot);
    assertEligiblePaymentStatus(snapshot);
    assertAmountWithinRemainingBalance(requestedAmount, snapshot.remaining_refundable_amount);

    const createdRefund = await this.refundRepository.create({
      ...input,
      requested_amount: requestedAmount,
      user_id: normalizedUserId,
      refund_number: buildRefundNumber(),
    });

    try {
      const recommendation = await getRefundRecommendation(
        {
          refund: {
            refundId: createdRefund.refund_id,
            orderId: createdRefund.order_id,
            reasonCode: createdRefund.reason_code,
            reasonDescription: createdRefund.reason_description,
            requestedAmount: createdRefund.requested_amount,
            createdAt: new Date(createdRefund.created_at).toISOString(),
            currency: snapshot.currency,
          },
          order: {
            status: snapshot.order_status,
            paymentStatus: snapshot.payment_status,
            totalAmount: snapshot.order_total_amount,
            remainingRefundableAmount: snapshot.remaining_refundable_amount,
          },
        },
        {
          userId: normalizedUserId,
        },
      );

      const persisted = await this.refundRepository.saveAIAnalysis({
        refundId: createdRefund.refund_id,
        ...mapRecommendationToPersistence(recommendation),
      });

      if (persisted) {
        return persisted;
      }
    } catch {
      // Preserve refund creation success semantics; fallback uses deterministic heuristic analysis.
    }

    try {
      return await analyzeRefundForCreatedRefund(this.refundRepository, createdRefund);
    } catch {
      return createdRefund;
    }
  }

  public async updateRefund(
    _userId: string,
    _refundId: string,
    _input: UpdateRefundDTO,
  ): Promise<RefundResponseDTO> {
    throw new Error('Refund update is not implemented yet');
  }

  public async transitionRefundStatus(
    _userId: string,
    _refundId: string,
    _transition: RefundStatusTransitionDTO,
  ): Promise<RefundResponseDTO> {
    throw new Error('Refund status transition is not implemented yet');
  }

  public async approveRefund(
    adminUserId: string,
    refundId: string,
    input: ApproveRefundDecisionDTO,
  ): Promise<RefundResponseDTO> {
    const normalizedUserId = normalizeUserId(adminUserId);
    return applyDecisionCommand({
      refundRepository: this.refundRepository,
      adminUserId: normalizedUserId,
      refundId,
      decision: 'approve',
      note: input.processing_notes,
    });
  }

  public async rejectRefund(
    adminUserId: string,
    refundId: string,
    input: RejectRefundDecisionDTO,
  ): Promise<RefundResponseDTO> {
    const normalizedUserId = normalizeUserId(adminUserId);
    return applyDecisionCommand({
      refundRepository: this.refundRepository,
      adminUserId: normalizedUserId,
      refundId,
      decision: 'reject',
      note: input.processing_notes,
    });
  }

  public async reviewRefund(
    adminUserId: string,
    refundId: string,
    input: ReviewRefundDecisionDTO,
  ): Promise<RefundResponseDTO> {
    const normalizedUserId = normalizeUserId(adminUserId);
    return applyDecisionCommand({
      refundRepository: this.refundRepository,
      adminUserId: normalizedUserId,
      refundId,
      decision: 'review',
      note: input.processing_notes,
    });
  }
}

const refundService = new RefundService();

export async function getRefundByIdForUser(
  userId: string,
  refundId: string,
): Promise<RefundResponseDTO> {
  return refundService.getRefundById(userId, refundId);
}

export async function getRefundDetailForUser(
  userId: string,
  refundId: string,
): Promise<RefundDetailDTO> {
  return refundService.getRefundDetail(userId, refundId);
}

export async function getBuyerRefundDetailForUser(
  userId: string,
  refundId: string,
): Promise<RefundDetailDTO> {
  return refundService.getBuyerRefundDetail(userId, refundId);
}

export async function listRefundsForUser(
  userId: string,
  filters: RefundFilterDTO,
): Promise<RefundListResponseDTO> {
  return refundService.listRefunds(userId, filters);
}

export async function listBuyerRefundsForUser(
  userId: string,
  filters: RefundFilterDTO,
): Promise<RefundListResponseDTO> {
  return refundService.listBuyerRefunds(userId, filters);
}

export async function createRefundForUser(
  userId: string,
  input: CreateRefundDTO,
): Promise<RefundResponseDTO> {
  return refundService.createRefund(userId, input);
}

export async function approveRefundForAdmin(
  adminUserId: string,
  refundId: string,
  input: ApproveRefundDecisionDTO,
): Promise<RefundResponseDTO> {
  return refundService.approveRefund(adminUserId, refundId, input);
}

export async function rejectRefundForAdmin(
  adminUserId: string,
  refundId: string,
  input: RejectRefundDecisionDTO,
): Promise<RefundResponseDTO> {
  return refundService.rejectRefund(adminUserId, refundId, input);
}

export async function reviewRefundForAdmin(
  adminUserId: string,
  refundId: string,
  input: ReviewRefundDecisionDTO,
): Promise<RefundResponseDTO> {
  return refundService.reviewRefund(adminUserId, refundId, input);
}

export interface IRefundReadService {
  getRefundById(userId: string, refundId: string): Promise<RefundResponseDTO>;
  getRefundDetail(userId: string, refundId: string): Promise<RefundDetailDTO>;
  getBuyerRefundDetail(userId: string, refundId: string): Promise<RefundDetailDTO>;
  listRefunds(userId: string, filters: RefundFilterDTO): Promise<RefundListResponseDTO>;
  listBuyerRefunds(userId: string, filters: RefundFilterDTO): Promise<RefundListResponseDTO>;
}

export interface IRefundWriteService {
  createRefund(userId: string, input: CreateRefundDTO): Promise<RefundResponseDTO>;
  updateRefund(
    userId: string,
    refundId: string,
    input: UpdateRefundDTO,
  ): Promise<RefundResponseDTO>;
  transitionRefundStatus(
    userId: string,
    refundId: string,
    transition: RefundStatusTransitionDTO,
  ): Promise<RefundResponseDTO>;
  approveRefund(
    adminUserId: string,
    refundId: string,
    input: ApproveRefundDecisionDTO,
  ): Promise<RefundResponseDTO>;
  rejectRefund(
    adminUserId: string,
    refundId: string,
    input: RejectRefundDecisionDTO,
  ): Promise<RefundResponseDTO>;
  reviewRefund(
    adminUserId: string,
    refundId: string,
    input: ReviewRefundDecisionDTO,
  ): Promise<RefundResponseDTO>;
}

export interface IRefundService extends IRefundReadService, IRefundWriteService {}
