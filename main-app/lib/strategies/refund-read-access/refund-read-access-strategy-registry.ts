import type { Database } from '@/lib/types/database.types';
import { AdminRefundReadAccessStrategy } from '@/lib/strategies/refund-read-access/admin-refund-read-access.strategy';
import { BuyerRefundReadAccessStrategy } from '@/lib/strategies/refund-read-access/buyer-refund-read-access.strategy';
import { SellerRefundReadAccessStrategy } from '@/lib/strategies/refund-read-access/seller-refund-read-access.strategy';
import type { RefundReadAccessStrategy } from '@/lib/strategies/refund-read-access/refund-read-access.strategy';

type UserRole = Database['public']['Enums']['user_role_enum'];

export class RefundReadAccessStrategyRegistry {
  public constructor(
    private readonly strategies: Partial<Record<UserRole, RefundReadAccessStrategy>>,
  ) {}

  public getForRole(role: UserRole): RefundReadAccessStrategy {
    const strategy = this.strategies[role];

    if (!strategy) {
      throw new Error('FORBIDDEN');
    }

    return strategy;
  }
}

export function createRefundReadAccessStrategyRegistry(): RefundReadAccessStrategyRegistry {
  return new RefundReadAccessStrategyRegistry({
    admin: new AdminRefundReadAccessStrategy(),
    buyer: new BuyerRefundReadAccessStrategy(),
    seller: new SellerRefundReadAccessStrategy(),
  });
}
