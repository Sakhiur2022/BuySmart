import type {
  RefundReadAccessContext,
  RefundReadAccessStrategy,
  RefundViewerIdentity,
} from '@/lib/strategies/refund-read-access/refund-read-access.strategy';
import type { IRefundReadRepository } from '@/lib/repositories/refund.repository';

export class AdminRefundReadAccessStrategy implements RefundReadAccessStrategy {
  public async assertCanRead(
    _viewer: RefundViewerIdentity,
    _context: RefundReadAccessContext,
    _refundRepository: IRefundReadRepository,
  ): Promise<void> {
    return;
  }
}
