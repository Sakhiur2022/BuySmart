import type { IRefundReadRepository } from '@/lib/repositories/refund.repository';
import type { Database } from '@/lib/types/database.types';
import type { RefundDetailDTO } from '@/lib/types/refund.types';

type UserRole = Database['public']['Enums']['user_role_enum'];

export type RefundViewerIdentity = {
  userId: string;
  role: UserRole;
};

export type RefundReadAccessContext = {
  refund: RefundDetailDTO;
};

export interface RefundReadAccessStrategy {
  assertCanRead(
    viewer: RefundViewerIdentity,
    context: RefundReadAccessContext,
    refundRepository: IRefundReadRepository,
  ): Promise<void>;
}
