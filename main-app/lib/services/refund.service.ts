import type {
  CreateRefundDTO,
  RefundDetailDTO,
  RefundFilterDTO,
  RefundListResponseDTO,
  RefundResponseDTO,
  RefundStatusTransitionDTO,
  UpdateRefundDTO,
} from '@/lib/types/refund.types';
import type { Database } from '@/lib/types/database.types';
import type {
  RefundEligibilitySnapshotDTO,
  IRefundRepository,
} from '@/lib/repositories/refund.repository';
import { RefundRepository } from '@/lib/repositories/refundRepository';

type OrderStatus = Database['public']['Enums']['order_status_enum'];

const ELIGIBLE_ORDER_STATUSES: ReadonlySet<OrderStatus> = new Set(['delivered', 'completed']);

export class RefundIneligibleStatusError extends Error {
  public readonly code = 'REFUND_INELIGIBLE_STATUS';
  public readonly orderStatus: OrderStatus;

  public constructor(orderStatus: OrderStatus) {
    super(`Refund not allowed for order status: ${orderStatus}`);
    this.name = 'RefundIneligibleStatusError';
    this.orderStatus = orderStatus;
  }
}

export class RefundInvalidAmountError extends Error {
  public readonly code = 'REFUND_INVALID_AMOUNT';

  public constructor(message: string) {
    super(message);
    this.name = 'RefundInvalidAmountError';
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

function normalizeListFilters(userId: string, filters: RefundFilterDTO): RefundFilterDTO {
  return {
    ...filters,
    buyer_id: userId,
    seller_id: undefined,
  };
}

function assertRefundOwnership(userId: string, refund: RefundResponseDTO | RefundDetailDTO): void {
  if (refund.user_id !== userId) {
    throw new Error('FORBIDDEN');
  }
}

function assertEligibleOrderStatus(snapshot: RefundEligibilitySnapshotDTO): void {
  if (!ELIGIBLE_ORDER_STATUSES.has(snapshot.order_status)) {
    throw new RefundIneligibleStatusError(snapshot.order_status);
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

export class RefundService implements IRefundService {
  public constructor(
    private readonly refundRepository: IRefundRepository = new RefundRepository(),
  ) {}

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
    const refund = await this.refundRepository.findDetailById(refundId);

    if (!refund) {
      throw new Error('Refund not found');
    }

    assertRefundOwnership(normalizedUserId, refund);
    return refund;
  }

  public async listRefunds(
    userId: string,
    filters: RefundFilterDTO,
  ): Promise<RefundListResponseDTO> {
    const normalizedUserId = normalizeUserId(userId);
    return this.refundRepository.list(normalizeListFilters(normalizedUserId, filters));
  }

  public async createRefund(userId: string, input: CreateRefundDTO): Promise<RefundResponseDTO> {
    const normalizedUserId = normalizeUserId(userId);
    const requestedAmount = ensureRequestedAmountIsValid(input.requested_amount);
    const snapshot = await this.refundRepository.getEligibilitySnapshot({
      orderId: input.order_id,
      buyerId: normalizedUserId,
    });

    if (!snapshot) {
      throw new Error('Order not found');
    }

    assertEligibleOrderStatus(snapshot);
    assertAmountWithinRemainingBalance(requestedAmount, snapshot.remaining_refundable_amount);

    return this.refundRepository.create({
      ...input,
      requested_amount: requestedAmount,
      user_id: normalizedUserId,
      refund_number: buildRefundNumber(),
    });
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

export async function listRefundsForUser(
  userId: string,
  filters: RefundFilterDTO,
): Promise<RefundListResponseDTO> {
  return refundService.listRefunds(userId, filters);
}

export async function createRefundForUser(
  userId: string,
  input: CreateRefundDTO,
): Promise<RefundResponseDTO> {
  return refundService.createRefund(userId, input);
}

export interface IRefundReadService {
  getRefundById(userId: string, refundId: string): Promise<RefundResponseDTO>;
  getRefundDetail(userId: string, refundId: string): Promise<RefundDetailDTO>;
  listRefunds(userId: string, filters: RefundFilterDTO): Promise<RefundListResponseDTO>;
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
}

export interface IRefundService extends IRefundReadService, IRefundWriteService {}
