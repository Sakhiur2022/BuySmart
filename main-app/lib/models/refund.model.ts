import type { Database } from '@/lib/types/database.types';

export type RefundStatus = Database['public']['Enums']['refund_status_enum'];
export type RefundReason = Database['public']['Enums']['refund_reason_enum'];
export type RefundType = Database['public']['Enums']['refund_type_enum'];
export type RefundAIDecision = Database['public']['Enums']['ai_refund_decision_enum'];

export interface MoneyAmount {
  readonly currency: string;
  readonly amount: number;
}

export class RefundItem {
  public readonly product_id: string;
  public readonly order_item_id: string | null;
  public readonly quantity: number;
  public readonly unit_amount: number;
  public readonly total_amount: number;

  public constructor(input: {
    product_id: string;
    order_item_id?: string | null;
    quantity: number;
    unit_amount: number;
    total_amount?: number;
  }) {
    const productId = input.product_id.trim();
    if (!productId) {
      throw new Error('RefundItem.product_id is required');
    }

    const quantity = Math.trunc(input.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('RefundItem.quantity must be a positive integer');
    }

    if (!Number.isFinite(input.unit_amount) || input.unit_amount < 0) {
      throw new Error('RefundItem.unit_amount must be a non-negative number');
    }

    const computedTotal = Number((input.unit_amount * quantity).toFixed(2));
    const totalAmount = Number((input.total_amount ?? computedTotal).toFixed(2));

    if (totalAmount < 0) {
      throw new Error('RefundItem.total_amount must be a non-negative number');
    }

    this.product_id = productId;
    this.order_item_id = input.order_item_id ?? null;
    this.quantity = quantity;
    this.unit_amount = Number(input.unit_amount.toFixed(2));
    this.total_amount = totalAmount;

    Object.freeze(this);
  }

  public equals(other: RefundItem): boolean {
    return (
      this.product_id === other.product_id &&
      this.order_item_id === other.order_item_id &&
      this.quantity === other.quantity &&
      this.unit_amount === other.unit_amount &&
      this.total_amount === other.total_amount
    );
  }

  public toJSON(): {
    product_id: string;
    order_item_id: string | null;
    quantity: number;
    unit_amount: number;
    total_amount: number;
  } {
    return {
      product_id: this.product_id,
      order_item_id: this.order_item_id,
      quantity: this.quantity,
      unit_amount: this.unit_amount,
      total_amount: this.total_amount,
    };
  }
}

export interface Refund {
  readonly refund_id: string;
  readonly refund_number: string;
  readonly order_id: string;
  readonly order_item_id: string | null;
  readonly user_id: string;
  readonly status: RefundStatus;
  readonly refund_type: RefundType;
  readonly reason_code: RefundReason;
  readonly reason_description: string | null;
  readonly requested_amount: number;
  readonly refund_amount: number;
  readonly return_required: boolean;
  readonly return_tracking: string | null;
  readonly return_received_at: string | null;
  readonly payment_reference: string | null;
  readonly processed_by: string | null;
  readonly processed_at: string | null;
  readonly processing_notes: string | null;
  readonly refunded_at: string | null;
  readonly ai_recommendation: RefundAIDecision | null;
  readonly ai_risk_score: number | null;
  readonly ai_processed_at: string | null;
  readonly ai_analysis: Database['public']['Tables']['refunds']['Row']['ai_analysis'];
  readonly evidence_images: Database['public']['Tables']['refunds']['Row']['evidence_images'];
  readonly created_at: string;
  readonly updated_at: string;
  readonly items: readonly RefundItem[];
}
