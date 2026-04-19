import type {
  CreateRefundDTO,
  RefundDetailDTO,
  RefundFilterDTO,
  RefundListResponseDTO,
  RefundResponseDTO,
} from '@/lib/types/refund.types';

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
}

export interface IRefundWriteRepository {
  create(
    input: CreateRefundDTO & { user_id: string; refund_number: string },
  ): Promise<RefundResponseDTO>;
}

export interface IRefundRepository extends IRefundReadRepository, IRefundWriteRepository {}
