import type {
  RefundReadAccessContext,
  RefundReadAccessStrategy,
  RefundViewerIdentity,
} from '@/lib/strategies/refund-read-access/refund-read-access.strategy';
import type { IRefundReadRepository } from '@/lib/repositories/refund.repository';

export class BuyerRefundReadAccessStrategy implements RefundReadAccessStrategy {
  public async assertCanRead(
    viewer: RefundViewerIdentity,
    context: RefundReadAccessContext,
    _refundRepository: IRefundReadRepository,
  ): Promise<void> {
    if (context.refund.user_id !== viewer.userId) {
      throw new Error('FORBIDDEN');
    }
  }
}
