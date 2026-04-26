import type {
  CreateRefundDTO,
  RefundDetailDTO,
  RefundRepositoryFilterDTO,
  RefundListResponseDTO,
  RefundResponseDTO,
} from '@/lib/types/refund.types';
import type { Database } from '@/lib/types/database.types';

type OrderStatus = Database['public']['Enums']['order_status_enum'];
type PaymentStatus = Database['public']['Enums']['payment_status_enum'];
type UserRole = Database['public']['Enums']['user_role_enum'];

export interface RefundEligibilitySnapshotDTO {
  order_id: string;
  buyer_id: string;
  order_status: OrderStatus;
  payment_status: PaymentStatus;
  order_total_amount: number;
  processed_refund_total: number;
  remaining_refundable_amount: number;
  currency: string;
}

export class RefundRepositoryError extends Error {
  public readonly code: string;

  public constructor(message: string, code = 'REFUND_REPOSITORY_ERROR') {
    super(message);
    this.name = 'RefundRepositoryError';
    this.code = code;
  }
}

export class RefundConflictError extends RefundRepositoryError {
  public constructor(message = 'Refund already exists') {
    super(message, 'REFUND_CONFLICT');
    this.name = 'RefundConflictError';
  }
}

export class RefundForeignKeyError extends RefundRepositoryError {
  public constructor(message = 'Refund references a missing related record') {
    super(message, 'REFUND_FOREIGN_KEY_ERROR');
    this.name = 'RefundForeignKeyError';
  }
}

export class RefundConstraintError extends RefundRepositoryError {
  public constructor(message = 'Refund data violates a database constraint') {
    super(message, 'REFUND_CONSTRAINT_ERROR');
    this.name = 'RefundConstraintError';
  }
}

export interface IRefundReadRepository {
  getUserRole(userId: string): Promise<UserRole | null>;
  findById(refundId: string): Promise<RefundResponseDTO | null>;
  findDetailById(refundId: string): Promise<RefundDetailDTO | null>;
  list(filters: RefundRepositoryFilterDTO): Promise<RefundListResponseDTO>;
  getEligibilitySnapshot(input: {
    orderId: string;
    buyerId: string;
  }): Promise<RefundEligibilitySnapshotDTO | null>;
}

export interface IRefundWriteRepository {
  create(
    input: CreateRefundDTO & { user_id: string; refund_number: string },
  ): Promise<RefundResponseDTO>;
  applyDecision(input: {
    refundId: string;
    fromStatus: Database['public']['Enums']['refund_status_enum'];
    toStatus: Database['public']['Enums']['refund_status_enum'];
    processedBy: string;
    processedAt: string;
    processingNotes: string;
  }): Promise<RefundResponseDTO | null>;
}

export interface IRefundRepository extends IRefundReadRepository, IRefundWriteRepository {}
