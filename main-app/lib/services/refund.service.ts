import type {
  CreateRefundDTO,
  RefundDetailDTO,
  RefundFilterDTO,
  RefundListResponseDTO,
  RefundResponseDTO,
  RefundStatusTransitionDTO,
  UpdateRefundDTO,
} from '@/lib/types/refund.types';

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
