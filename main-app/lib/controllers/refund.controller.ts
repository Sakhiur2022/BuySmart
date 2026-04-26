import type {
  ApproveRefundDecisionDTO,
  CreateRefundDTO,
  RejectRefundDecisionDTO,
  RefundDetailDTO,
  RefundFilterDTO,
  RefundListResponseDTO,
  RefundResponseDTO,
  ReviewRefundDecisionDTO,
} from '@/lib/types/refund.types';
import {
  approveRefundForAdmin,
  createRefundForUser,
  getRefundDetailForUser,
  listRefundsForUser,
  rejectRefundForAdmin,
  reviewRefundForAdmin,
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

export async function approveRefund(
  adminUserId: string,
  refundId: string,
  input: ApproveRefundDecisionDTO,
): Promise<RefundResponseDTO> {
  return approveRefundForAdmin(adminUserId, refundId, input);
}

export async function rejectRefund(
  adminUserId: string,
  refundId: string,
  input: RejectRefundDecisionDTO,
): Promise<RefundResponseDTO> {
  return rejectRefundForAdmin(adminUserId, refundId, input);
}

export async function reviewRefund(
  adminUserId: string,
  refundId: string,
  input: ReviewRefundDecisionDTO,
): Promise<RefundResponseDTO> {
  return reviewRefundForAdmin(adminUserId, refundId, input);
}
