import type { RefundOrderSignal } from '@/lib/chatbot/buyer-intent/types';
import type { RefundRequestToolInput } from '@/lib/chatbot/buyer-intent/tool-factory';
import { createRefund } from '@/lib/controllers/refund.controller';
import { getRefundToolEventEmitter } from '@/lib/services/refund-tools/events';
import {
  RecentOrdersStrategy,
  SpecificOrderStrategy,
  selectOrderFetchStrategy,
  type OrderFetchStrategy,
} from '@/lib/services/refund-tools/order-fetch-strategies';
import type {
  RefundOrdersFetchResult,
  RefundSubmitResult,
} from '@/lib/services/refund-tools/types';
import { RefundSubmitCommandBuilder } from '@/lib/services/refund-tools/refund-submit-command-builder';

export class BuyerRefundToolFacade {
  private readonly orderStrategies: OrderFetchStrategy[];
  private readonly submitCommandBuilder: RefundSubmitCommandBuilder;

  public constructor(input?: {
    orderStrategies?: OrderFetchStrategy[];
    submitCommandBuilder?: RefundSubmitCommandBuilder;
  }) {
    this.orderStrategies = input?.orderStrategies ?? [
      new SpecificOrderStrategy(),
      new RecentOrdersStrategy(),
    ];
    this.submitCommandBuilder = input?.submitCommandBuilder ?? new RefundSubmitCommandBuilder();
  }

  async fetchOrders(input: {
    buyerId: string;
    orderSignal?: RefundOrderSignal;
  }): Promise<RefundOrdersFetchResult> {
    const context = {
      buyerId: input.buyerId,
      orderSignal: input.orderSignal,
    };

    const strategy = selectOrderFetchStrategy(this.orderStrategies, context);
    const result = await strategy.fetch(context);

    getRefundToolEventEmitter().emit({
      type: 'orders_fetched',
      buyerId: input.buyerId,
      count: result.orders.length,
      orders: result.orders,
      timestamp: Date.now(),
    });

    return result;
  }

  async submitRefund(input: {
    buyerId: string;
    payload: RefundRequestToolInput;
  }): Promise<RefundSubmitResult> {
    const command = this.submitCommandBuilder.build(input.payload);
    const refund = await createRefund(input.buyerId, command);

    const result: RefundSubmitResult = {
      refund: {
        refund_id: refund.refund_id,
        refund_number: refund.refund_number,
        order_id: refund.order_id,
        status: refund.status,
        requested_amount: refund.requested_amount,
        created_at: refund.created_at,
      },
    };

    getRefundToolEventEmitter().emit({
      type: 'refund_submitted',
      buyerId: input.buyerId,
      orderId: refund.order_id,
      refundId: refund.refund_id,
      refundNumber: refund.refund_number,
      timestamp: Date.now(),
    });

    return result;
  }
}
