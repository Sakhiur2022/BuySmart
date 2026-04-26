import type { IRefundReadRepository } from '@/lib/repositories/refund.repository';
import type {
  RefundReadAccessContext,
  RefundReadAccessStrategy,
  RefundViewerIdentity,
} from '@/lib/strategies/refund-read-access/refund-read-access.strategy';

export class SellerRefundReadAccessStrategy implements RefundReadAccessStrategy {
  public async assertCanRead(
    viewer: RefundViewerIdentity,
    context: RefundReadAccessContext,
    refundRepository: IRefundReadRepository,
  ): Promise<void> {
    const isInScope = await refundRepository.isSellerScopedToRefund(
      context.refund.refund_id,
      viewer.userId,
    );

    if (!isInScope) {
      throw new Error('FORBIDDEN');
    }
  }
}
