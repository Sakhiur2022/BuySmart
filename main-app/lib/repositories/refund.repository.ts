import type { Refund } from '@/lib/models/refund.model';
import type { CreateRefundDTO, RefundFilterDTO, UpdateRefundDTO } from '@/lib/types/refund.types';

export interface RefundQueryResult {
  refunds: Refund[];
  totalCount: number;
}

export interface IRefundReadRepository {
  findById(refundId: string): Promise<Refund | null>;
  list(filters: RefundFilterDTO): Promise<RefundQueryResult>;
  listByOrderId(orderId: string): Promise<Refund[]>;
  existsActiveRefundForOrderItem(orderItemId: string): Promise<boolean>;
}

export interface IRefundWriteRepository {
  create(input: CreateRefundDTO & { user_id: string; refund_number: string }): Promise<Refund>;
  update(refundId: string, input: UpdateRefundDTO): Promise<Refund | null>;
}

export interface IRefundRepository extends IRefundReadRepository, IRefundWriteRepository {}
