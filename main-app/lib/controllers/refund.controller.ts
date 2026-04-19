import type {
  CreateRefundDTO,
  RefundDetailDTO,
  RefundFilterDTO,
  RefundListResponseDTO,
  RefundResponseDTO,
} from '@/lib/types/refund.types';
import {
  createRefundForUser,
  getRefundDetailForUser,
  listRefundsForUser,
} from '@/lib/services/refund.service';

export async function createRefund(
  userId: string,
  input: CreateRefundDTO,
): Promise<RefundResponseDTO> {
  return createRefundForUser(userId, input);
}

export async function getRefundById(userId: string, refundId: string): Promise<RefundDetailDTO> {
  return getRefundDetailForUser(userId, refundId);
}

export async function listRefunds(
  userId: string,
  filters: RefundFilterDTO,
): Promise<RefundListResponseDTO> {
  return listRefundsForUser(userId, filters);
}
