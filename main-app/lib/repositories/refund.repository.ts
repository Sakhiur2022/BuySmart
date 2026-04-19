import type {
  CreateRefundDTO,
  RefundDetailDTO,
  RefundFilterDTO,
  RefundListResponseDTO,
  RefundResponseDTO,
} from '@/lib/types/refund.types';
import type { Database } from '@/lib/types/database.types';

type OrderStatus = Database['public']['Enums']['order_status_enum'];

export interface RefundEligibilitySnapshotDTO {
  order_id: string;
  buyer_id: string;
  order_status: OrderStatus;
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
  findById(refundId: string): Promise<RefundResponseDTO | null>;
  findDetailById(refundId: string): Promise<RefundDetailDTO | null>;
  list(filters: RefundFilterDTO): Promise<RefundListResponseDTO>;
  getEligibilitySnapshot(input: {
    orderId: string;
    buyerId: string;
  }): Promise<RefundEligibilitySnapshotDTO | null>;
}

export interface IRefundWriteRepository {
  create(
    input: CreateRefundDTO & { user_id: string; refund_number: string },
  ): Promise<RefundResponseDTO>;
}

export interface IRefundRepository extends IRefundReadRepository, IRefundWriteRepository {}
