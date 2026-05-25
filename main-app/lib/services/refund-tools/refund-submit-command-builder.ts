import type { RefundRequestToolInput } from '@/lib/chatbot/buyer-intent/tool-factory';

export class RefundSubmitCommandError extends Error {
  public readonly code = 'REFUND_VALIDATION_ERROR';

  public constructor(message: string) {
    super(message);
    this.name = 'RefundSubmitCommandError';
  }
}

export class RefundSubmitCommandBuilder {
  build(input: RefundRequestToolInput): RefundRequestToolInput {
    if (!input.order_id?.trim()) {
      throw new RefundSubmitCommandError('Order id is required for refund submission.');
    }

    if (!input.reason_code) {
      throw new RefundSubmitCommandError('Refund reason is required for refund submission.');
    }

    if (!Number.isFinite(input.requested_amount)) {
      throw new RefundSubmitCommandError('Refund amount is required for refund submission.');
    }

    return input;
  }
}
