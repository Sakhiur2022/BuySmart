import type { PostgrestError } from '@supabase/supabase-js';

import { RefundItem, type Refund } from '@/lib/models/refund.model';
import { REFUND_REASON_VALUES } from '@/lib/types/refund.types';
import type {
  CreateRefundDTO,
  RefundDetailDTO,
  RefundFilterDTO,
  RefundItemDTO,
  RefundListResponseDTO,
  RefundRepositoryFilterDTO,
  RefundResponseDTO,
  RefundSummaryDTO,
} from '@/lib/types/refund.types';
import { createClient } from '@/lib/supabase/server';
import type { Database, Json } from '@/lib/types/database.types';

import {
  RefundConflictError,
  RefundConstraintError,
  RefundForeignKeyError,
  RefundRepositoryError,
  type RefundEligibilitySnapshotDTO,
  type IRefundRepository,
} from '@/lib/repositories/refund.repository';

type RefundRow = Database['public']['Tables']['refunds']['Row'];
type RefundInsert = Database['public']['Tables']['refunds']['Insert'];
type OrderRow = Database['public']['Tables']['orders']['Row'];
type OrderItemRow = Database['public']['Tables']['order_items']['Row'];
type UserProfileRow = Database['public']['Tables']['users_profile']['Row'];
type OrderStatus = Database['public']['Enums']['order_status_enum'];
type PaymentStatus = Database['public']['Enums']['payment_status_enum'];
type RefundStatus = Database['public']['Enums']['refund_status_enum'];
type UserRole = Database['public']['Enums']['user_role_enum'];

const AMOUNT_ACCUMULATION_REFUND_STATUSES: readonly RefundStatus[] = [
  'approved',
  'processing',
  'completed',
];

type NormalizedFilters = {
  page: number;
  pageSize: number;
  status?: RefundFilterDTO['status'];
  reason_code?: RefundFilterDTO['reason_code'];
  buyer_id?: string;
  order_id?: string;
  order_item_id?: string;
  processed_by?: string;
  createdAfter?: string;
  createdBefore?: string;
  sortColumn: 'created_at' | 'requested_amount';
  sortAscending: boolean;
};

type DetailRelations = {
  buyer: {
    user_id: string;
    full_name: string | null;
    email: string | null;
  };
  seller: {
    user_id: string;
    full_name: string | null;
    email: string | null;
  } | null;
  order: {
    order_id: string;
    order_number: string;
    created_at: string;
    currency: string;
    total_amount: number;
  };
};

export class RefundRepository implements IRefundRepository {
  public constructor(private readonly clientFactory: typeof createClient = createClient) {}

  public async getUserRole(userId: string): Promise<UserRole | null> {
    const supabase = await this.clientFactory();
    const { data, error } = await supabase
      .from('users_profile')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      this.throwMappedError(error, 'Failed to fetch user role');
    }

    return (data?.role as UserRole | undefined) ?? null;
  }

  public async create(
    input: CreateRefundDTO & { user_id: string; refund_number: string },
  ): Promise<RefundResponseDTO> {
    const supabase = await this.clientFactory();
    const payload = this.toInsertRow(input);

    // There is no dedicated refund-items table in the current schema.
    // Parent insert is therefore the complete atomic write for RFND-02.
    const { data, error } = await supabase.from('refunds').insert(payload).select('*').single();

    if (error) {
      this.throwMappedError(error, 'Failed to create refund');
    }

    const createdRow = data as RefundRow;
    const items = this.mapRefundItemsFromDTO(input.items);
    const entity = this.toEntity(createdRow, items);

    return this.toResponseDTO(entity);
  }

  public async saveAIAnalysis(input: {
    refundId: string;
    status?: RefundStatus;
    aiRecommendation: Database['public']['Enums']['ai_refund_decision_enum'];
    aiRiskScore: number;
    aiAnalysis: Record<string, unknown>;
    aiProcessedAt: string;
  }): Promise<RefundResponseDTO | null> {
    const supabase = await this.clientFactory();
    const updatePayload: Database['public']['Tables']['refunds']['Update'] = {
      ai_recommendation: input.aiRecommendation,
      ai_risk_score: input.aiRiskScore,
      ai_analysis: input.aiAnalysis as Json,
      ai_processed_at: input.aiProcessedAt,
    };

    if (input.status) {
      updatePayload.status = input.status;
    }

    const { data, error } = await supabase
      .from('refunds')
      .update(updatePayload)
      .eq('refund_id', input.refundId)
      .select('*')
      .maybeSingle();

    if (error) {
      this.throwMappedError(error, 'Failed to save refund AI analysis');
    }

    if (!data) {
      return null;
    }

    const row = data as RefundRow;
    const items = await this.fetchRefundItems(row, supabase);
    const entity = this.toEntity(row, items);
    return this.toResponseDTO(entity);
  }

  public async applyDecision(input: {
    refundId: string;
    fromStatus: RefundStatus;
    toStatus: RefundStatus;
    processedBy: string;
    processedAt: string;
    processingNotes: string;
  }): Promise<RefundResponseDTO | null> {
    const supabase = await this.clientFactory();
    const { data, error } = await supabase
      .from('refunds')
      .update({
        status: input.toStatus,
        processed_by: input.processedBy,
        processed_at: input.processedAt,
        processing_notes: input.processingNotes,
      })
      .eq('refund_id', input.refundId)
      .eq('status', input.fromStatus)
      .select('*')
      .maybeSingle();

    if (error) {
      this.throwMappedError(error, 'Failed to apply refund decision');
    }

    if (!data) {
      return null;
    }

    const row = data as RefundRow;
    const items = await this.fetchRefundItems(row, supabase);
    const entity = this.toEntity(row, items);
    return this.toResponseDTO(entity);
  }

  public async list(filters: RefundRepositoryFilterDTO): Promise<RefundListResponseDTO> {
    const supabase = await this.clientFactory();
    const normalized = this.normalizeFilters(filters);
    const offset = (normalized.page - 1) * normalized.pageSize;

    let query = supabase
      .from('refunds')
      .select('*, buyer:users_profile!refunds_user_id_fkey(user_id, full_name, display_name)', {
        count: 'exact',
      })
      .order(normalized.sortColumn, { ascending: normalized.sortAscending })
      .range(offset, offset + normalized.pageSize - 1);

    if (normalized.status) {
      query = query.eq('status', normalized.status);
    }

    if (normalized.reason_code) {
      query = query.eq('reason_code', normalized.reason_code);
    }

    if (normalized.buyer_id) {
      query = query.eq('user_id', normalized.buyer_id);
    }

    if (normalized.order_id) {
      query = query.eq('order_id', normalized.order_id);
    }

    if (normalized.order_item_id) {
      query = query.eq('order_item_id', normalized.order_item_id);
    }

    if (normalized.processed_by) {
      query = query.eq('processed_by', normalized.processed_by);
    }

    if (normalized.createdAfter) {
      query = query.gte('created_at', normalized.createdAfter);
    }

    if (normalized.createdBefore) {
      query = query.lte('created_at', normalized.createdBefore);
    }

    if (this.hasSellerScope(filters)) {
      const scopedOrderIds = await this.findOrderIdsBySellerId(filters.seller_id, supabase);

      if (scopedOrderIds.length === 0) {
        return {
          refunds: [],
          pagination: {
            page: normalized.page,
            pageSize: normalized.pageSize,
            totalCount: 0,
            totalPages: 0,
          },
        };
      }

      query = query.in('order_id', scopedOrderIds);
    }

    const { data, count, error } = await query;

    if (error) {
      this.throwMappedError(error, 'Failed to list refunds');
    }

    const rows = (data ?? []) as Array<
      RefundRow & {
        buyer?: { user_id: string; full_name: string | null; display_name: string | null } | null;
      }
    >;
    const totalCount = count ?? 0;
    const totalPages = Math.ceil(totalCount / normalized.pageSize);

    return {
      refunds: rows.map((row) => {
        const summary = this.toSummaryDTO(this.toEntity(row, []));
        const buyerName = row.buyer?.display_name || row.buyer?.full_name || null;
        return {
          ...summary,
          buyer_name: buyerName,
        };
      }),
      pagination: {
        page: normalized.page,
        pageSize: normalized.pageSize,
        totalCount,
        totalPages,
      },
    };
  }

  public async findById(refundId: string): Promise<RefundResponseDTO | null> {
    const supabase = await this.clientFactory();
    const { data, error } = await supabase
      .from('refunds')
      .select('*')
      .eq('refund_id', refundId)
      .maybeSingle();

    if (error) {
      this.throwMappedError(error, 'Failed to fetch refund');
    }

    if (!data) {
      return null;
    }

    const row = data as RefundRow;
    const items = await this.fetchRefundItems(row, supabase);
    const entity = this.toEntity(row, items);

    return this.toResponseDTO(entity);
  }

  public async findDetailById(refundId: string): Promise<RefundDetailDTO | null> {
    const supabase = await this.clientFactory();
    const { data, error } = await supabase
      .from('refunds')
      .select('*, order_item:order_items!refunds_order_item_id_fkey(order_item_id, seller_id)')
      .eq('refund_id', refundId)
      .maybeSingle();

    if (error) {
      this.throwMappedError(error, 'Failed to fetch refund detail');
    }

    if (!data) {
      return null;
    }

    const row = data as RefundRow;
    const items = await this.fetchRefundItems(row, supabase);
    const relations = await this.fetchDetailRelations(row, items, supabase);
    const entity = this.toEntity(row, items);

    return this.toDetailDTO(entity, relations);
  }

  public async isSellerScopedToRefund(refundId: string, sellerId: string): Promise<boolean> {
    const supabase = await this.clientFactory();
    const { data: refundRow, error: refundError } = await supabase
      .from('refunds')
      .select('order_id, order_item_id')
      .eq('refund_id', refundId)
      .maybeSingle();

    if (refundError) {
      this.throwMappedError(refundError, 'Failed to load refund scope context');
    }

    if (!refundRow) {
      return false;
    }

    let query = supabase
      .from('order_items')
      .select('order_item_id')
      .eq('seller_id', sellerId)
      .limit(1);

    if (refundRow.order_item_id) {
      query = query.eq('order_item_id', refundRow.order_item_id);
    } else {
      query = query.eq('order_id', refundRow.order_id);
    }

    const { data: scopedRow, error: scopeError } = await query.maybeSingle();

    if (scopeError) {
      this.throwMappedError(scopeError, 'Failed to verify seller refund scope');
    }

    return Boolean(scopedRow);
  }

  public async getEligibilitySnapshot(input: {
    orderId: string;
    buyerId: string;
  }): Promise<RefundEligibilitySnapshotDTO | null> {
    const supabase = await this.clientFactory();
    const { data: orderRow, error: orderError } = await supabase
      .from('orders')
      .select('order_id, buyer_id, status, payment_status, total_amount, currency')
      .eq('order_id', input.orderId)
      .eq('buyer_id', input.buyerId)
      .maybeSingle();

    if (orderError) {
      this.throwMappedError(orderError, 'Failed to fetch refund eligibility order');
    }

    if (!orderRow) {
      return null;
    }

    const { data: refunds, error: refundError } = await supabase
      .from('refunds')
      .select('refund_amount, status')
      .eq('order_id', input.orderId)
      .in('status', [...AMOUNT_ACCUMULATION_REFUND_STATUSES]);

    if (refundError) {
      this.throwMappedError(refundError, 'Failed to fetch existing refunds for eligibility');
    }

    const processedRefundTotal = (refunds ?? []).reduce((sum, row) => {
      const amount = typeof row.refund_amount === 'number' ? row.refund_amount : 0;
      return sum + amount;
    }, 0);

    const orderTotal = this.roundCurrency(orderRow.total_amount);
    const accumulated = this.roundCurrency(processedRefundTotal);
    const remaining = this.roundCurrency(Math.max(orderTotal - accumulated, 0));

    return {
      order_id: orderRow.order_id,
      buyer_id: orderRow.buyer_id,
      order_status: orderRow.status as OrderStatus,
      payment_status: orderRow.payment_status as PaymentStatus,
      order_total_amount: orderTotal,
      processed_refund_total: accumulated,
      remaining_refundable_amount: remaining,
      currency: orderRow.currency,
    };
  }

  private normalizeFilters(filters: RefundRepositoryFilterDTO): NormalizedFilters {
    const raw = filters as Record<string, unknown>;
    const page = Number.isInteger(filters.page) && filters.page > 0 ? filters.page : 1;
    const pageSize =
      Number.isInteger(filters.pageSize) && filters.pageSize > 0
        ? Math.min(filters.pageSize, 100)
        : 20;

    let sortColumn: 'created_at' | 'requested_amount' = 'created_at';
    let sortAscending = false;

    switch (filters.sortBy) {
      case 'oldest':
        sortColumn = 'created_at';
        sortAscending = true;
        break;
      case 'amount_high':
        sortColumn = 'requested_amount';
        sortAscending = false;
        break;
      case 'amount_low':
        sortColumn = 'requested_amount';
        sortAscending = true;
        break;
      case 'recent':
      default:
        sortColumn = 'created_at';
        sortAscending = false;
        break;
    }

    if (raw.sortBy === 'createdAt') {
      sortColumn = 'created_at';
    }

    if (raw.sortOrder === 'asc') {
      sortAscending = true;
    }

    if (raw.sortOrder === 'desc') {
      sortAscending = false;
    }

    const createdAfter = this.resolveCreatedAfter(filters, raw);
    const createdBefore = this.resolveCreatedBefore(filters, raw);

    return {
      page,
      pageSize,
      status: filters.status,
      reason_code: this.resolveReasonCode(filters, raw),
      buyer_id: this.resolveBuyerId(filters, raw),
      order_id: filters.order_id,
      order_item_id: filters.order_item_id,
      processed_by: filters.processed_by,
      createdAfter,
      createdBefore,
      sortColumn,
      sortAscending,
    };
  }

  private resolveReasonCode(
    filters: RefundFilterDTO,
    raw: Record<string, unknown>,
  ): RefundFilterDTO['reason_code'] {
    if (filters.reason_code) {
      return filters.reason_code;
    }

    if (
      typeof raw.reason === 'string' &&
      (REFUND_REASON_VALUES as readonly string[]).includes(raw.reason)
    ) {
      return raw.reason as RefundFilterDTO['reason_code'];
    }

    return undefined;
  }

  private resolveBuyerId(
    filters: RefundFilterDTO,
    raw: Record<string, unknown>,
  ): string | undefined {
    if (filters.buyer_id) {
      return filters.buyer_id;
    }

    if (typeof raw.buyerId === 'string' && raw.buyerId.trim()) {
      return raw.buyerId;
    }

    return undefined;
  }

  private resolveCreatedAfter(
    filters: RefundFilterDTO,
    raw: Record<string, unknown>,
  ): string | undefined {
    if (typeof raw.createdAfter === 'string' && raw.createdAfter.trim()) {
      return raw.createdAfter;
    }

    if (filters.dateFrom) {
      return `${filters.dateFrom}T00:00:00.000Z`;
    }

    return undefined;
  }

  private resolveCreatedBefore(
    filters: RefundFilterDTO,
    raw: Record<string, unknown>,
  ): string | undefined {
    if (typeof raw.createdBefore === 'string' && raw.createdBefore.trim()) {
      return raw.createdBefore;
    }

    if (filters.dateTo) {
      return `${filters.dateTo}T23:59:59.999Z`;
    }

    return undefined;
  }

  private hasSellerScope(
    filters: RefundRepositoryFilterDTO,
  ): filters is RefundRepositoryFilterDTO & { seller_id: string } {
    return typeof filters.seller_id === 'string' && filters.seller_id.trim().length > 0;
  }

  private async findOrderIdsBySellerId(
    sellerId: string,
    supabase: Awaited<ReturnType<typeof createClient>>,
  ): Promise<string[]> {
    const { data, error } = await supabase
      .from('order_items')
      .select('order_id')
      .eq('seller_id', sellerId);

    if (error) {
      this.throwMappedError(error, 'Failed to apply seller scope filter');
    }

    const orderIds = new Set<string>();
    (data ?? []).forEach((row) => {
      orderIds.add(row.order_id);
    });

    return [...orderIds];
  }

  private async fetchRefundItems(
    refund: RefundRow,
    supabase: Awaited<ReturnType<typeof createClient>>,
  ): Promise<RefundItem[]> {
    let query = supabase
      .from('order_items')
      .select('order_item_id, product_id, quantity, unit_price, total_price')
      .eq('order_id', refund.order_id)
      .order('created_at', { ascending: true });

    if (refund.order_item_id) {
      query = query.eq('order_item_id', refund.order_item_id);
    }

    const { data, error } = await query;

    if (error) {
      this.throwMappedError(error, 'Failed to load refund line items');
    }

    const rows = (data ?? []) as Array<
      Pick<OrderItemRow, 'order_item_id' | 'product_id' | 'quantity' | 'unit_price' | 'total_price'>
    >;

    return rows.map(
      (row) =>
        new RefundItem({
          order_item_id: row.order_item_id,
          product_id: row.product_id,
          quantity: row.quantity,
          unit_amount: row.unit_price,
          total_amount: row.total_price,
        }),
    );
  }

  private async fetchDetailRelations(
    refund: RefundRow,
    items: RefundItem[],
    supabase: Awaited<ReturnType<typeof createClient>>,
  ): Promise<DetailRelations> {
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('order_id, order_number, created_at, currency, total_amount, buyer_id')
      .eq('order_id', refund.order_id)
      .maybeSingle();

    if (orderError) {
      this.throwMappedError(orderError, 'Failed to load related order');
    }

    if (!orderData) {
      throw new RefundRepositoryError(
        'Related order not found for refund',
        'REFUND_RELATION_NOT_FOUND',
      );
    }

    const typedOrder = orderData as Pick<
      OrderRow,
      'order_id' | 'order_number' | 'created_at' | 'currency' | 'total_amount' | 'buyer_id'
    >;

    const buyer = await this.fetchUserProfileSummary(typedOrder.buyer_id, supabase);
    if (!buyer) {
      throw new RefundRepositoryError(
        'Related buyer profile not found for refund',
        'REFUND_RELATION_NOT_FOUND',
      );
    }

    const sellerId = await this.resolveSellerId(refund, items, supabase);
    const seller = sellerId ? await this.fetchUserProfileSummary(sellerId, supabase) : null;

    return {
      buyer,
      seller,
      order: {
        order_id: typedOrder.order_id,
        order_number: typedOrder.order_number,
        created_at: typedOrder.created_at,
        currency: typedOrder.currency,
        total_amount: typedOrder.total_amount,
      },
    };
  }

  private async resolveSellerId(
    refund: RefundRow,
    items: RefundItem[],
    supabase: Awaited<ReturnType<typeof createClient>>,
  ): Promise<string | null> {
    if (items.length > 0 && items[0]?.order_item_id) {
      const { data, error } = await supabase
        .from('order_items')
        .select('seller_id')
        .eq('order_item_id', items[0].order_item_id)
        .maybeSingle();

      if (error) {
        this.throwMappedError(error, 'Failed to resolve refund seller');
      }

      if (data?.seller_id) {
        return data.seller_id;
      }
    }

    const { data, error } = await supabase
      .from('order_items')
      .select('seller_id')
      .eq('order_id', refund.order_id)
      .limit(1)
      .maybeSingle();

    if (error) {
      this.throwMappedError(error, 'Failed to resolve order seller');
    }

    return data?.seller_id ?? null;
  }

  private async fetchUserProfileSummary(
    userId: string,
    supabase: Awaited<ReturnType<typeof createClient>>,
  ): Promise<{ user_id: string; full_name: string | null; email: string | null } | null> {
    const { data, error } = await supabase
      .from('users_profile')
      .select('user_id, full_name')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      this.throwMappedError(error, 'Failed to load user profile relation');
    }

    if (!data) {
      return null;
    }

    const profile = data as Pick<UserProfileRow, 'user_id' | 'full_name'>;

    return {
      user_id: profile.user_id,
      full_name: profile.full_name,
      email: null,
    };
  }

  private mapRefundItemsFromDTO(items: CreateRefundDTO['items']): RefundItem[] {
    if (!items || items.length === 0) {
      return [];
    }

    return items.map(
      (item) =>
        new RefundItem({
          product_id: item.product_id,
          order_item_id: item.order_item_id ?? null,
          quantity: item.quantity,
          unit_amount: item.unit_amount,
          total_amount: item.total_amount,
        }),
    );
  }

  private toEntity(row: RefundRow, items: RefundItem[]): Refund {
    return {
      refund_id: row.refund_id,
      refund_number: row.refund_number,
      order_id: row.order_id,
      order_item_id: row.order_item_id,
      user_id: row.user_id,
      status: row.status,
      refund_type: row.refund_type,
      reason_code: row.reason_code,
      reason_description: row.reason_description,
      requested_amount: row.requested_amount,
      refund_amount: row.refund_amount,
      return_required: row.return_required,
      return_tracking: row.return_tracking,
      return_received_at: row.return_received_at,
      payment_reference: row.payment_reference,
      processed_by: row.processed_by,
      processed_at: row.processed_at,
      processing_notes: row.processing_notes,
      refunded_at: row.refunded_at,
      ai_recommendation: row.ai_recommendation,
      ai_risk_score: row.ai_risk_score,
      ai_processed_at: row.ai_processed_at,
      ai_analysis: row.ai_analysis,
      evidence_images: row.evidence_images,
      created_at: row.created_at,
      updated_at: row.updated_at,
      items,
    };
  }

  private toResponseDTO(entity: Refund): RefundResponseDTO {
    return {
      refund_id: entity.refund_id,
      refund_number: entity.refund_number,
      order_id: entity.order_id,
      order_item_id: entity.order_item_id,
      user_id: entity.user_id,
      status: entity.status,
      reason_code: entity.reason_code,
      refund_type: entity.refund_type,
      requested_amount: entity.requested_amount,
      refund_amount: entity.refund_amount,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
      reason_description: entity.reason_description,
      return_required: entity.return_required,
      return_tracking: entity.return_tracking,
      return_received_at: entity.return_received_at,
      payment_reference: entity.payment_reference,
      processed_by: entity.processed_by,
      processed_at: entity.processed_at,
      processing_notes: entity.processing_notes,
      refunded_at: entity.refunded_at,
      ai_recommendation: entity.ai_recommendation,
      ai_risk_score: entity.ai_risk_score,
      ai_processed_at: entity.ai_processed_at,
      ai_analysis:
        entity.ai_analysis && typeof entity.ai_analysis === 'object' && !Array.isArray(entity.ai_analysis)
          ? (entity.ai_analysis as Record<string, unknown>)
          : null,
      evidence_images: this.mapEvidenceImages(entity.evidence_images),
      items: this.mapItemsToDTO(entity.items),
    };
  }

  private toDetailDTO(entity: Refund, relations: DetailRelations): RefundDetailDTO {
    return {
      refund_id: entity.refund_id,
      refund_number: entity.refund_number,
      order_id: entity.order_id,
      order_item_id: entity.order_item_id,
      user_id: entity.user_id,
      status: entity.status,
      reason_code: entity.reason_code,
      refund_type: entity.refund_type,
      requested_amount: entity.requested_amount,
      refund_amount: entity.refund_amount,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
      buyer: relations.buyer,
      seller: relations.seller,
      order: relations.order,
      items: this.mapItemsToDTO(entity.items),
      reason_description: entity.reason_description,
      processing_notes: entity.processing_notes,
      ai_recommendation: entity.ai_recommendation,
      ai_risk_score: entity.ai_risk_score,
      ai_processed_at: entity.ai_processed_at,
      ai_analysis:
        entity.ai_analysis && typeof entity.ai_analysis === 'object' && !Array.isArray(entity.ai_analysis)
          ? (entity.ai_analysis as Record<string, unknown>)
          : null,
      return_required: entity.return_required,
      return_tracking: entity.return_tracking,
      return_received_at: entity.return_received_at,
      payment_reference: entity.payment_reference,
      refunded_at: entity.refunded_at,
    };
  }

  private toInsertRow(
    input: CreateRefundDTO & { user_id: string; refund_number: string },
  ): RefundInsert {
    return {
      refund_number: input.refund_number,
      order_id: input.order_id,
      order_item_id: input.order_item_id ?? null,
      user_id: input.user_id,
      refund_type: input.refund_type,
      reason_code: input.reason_code,
      reason_description: input.reason_description ?? null,
      requested_amount: input.requested_amount,
      refund_amount: input.requested_amount,
      return_required: input.return_required ?? false,
      evidence_images: this.toJsonStringArrayOrNull(input.evidence_images),
      status: 'pending',
    };
  }

  private toSummaryDTO(entity: Refund): RefundSummaryDTO {
    return {
      refund_id: entity.refund_id,
      refund_number: entity.refund_number,
      order_id: entity.order_id,
      user_id: entity.user_id,
      status: entity.status,
      reason_code: entity.reason_code,
      refund_type: entity.refund_type,
      requested_amount: entity.requested_amount,
      refund_amount: entity.refund_amount,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
      reason_description: entity.reason_description,
      ai_recommendation: entity.ai_recommendation,
      ai_risk_score: entity.ai_risk_score,
      ai_processed_at: entity.ai_processed_at,
      ai_analysis:
        entity.ai_analysis && typeof entity.ai_analysis === 'object' && !Array.isArray(entity.ai_analysis)
          ? (entity.ai_analysis as Record<string, unknown>)
          : null,
    };
  }

  private mapItemsToDTO(items: readonly RefundItem[]): RefundItemDTO[] {
    return items.map((item) => ({
      product_id: item.product_id,
      order_item_id: item.order_item_id,
      quantity: item.quantity,
      unit_amount: item.unit_amount,
      total_amount: item.total_amount,
    }));
  }

  private mapEvidenceImages(value: Json): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item): item is string => typeof item === 'string');
  }

  private toJsonStringArrayOrNull(value: string[] | undefined): Json | null {
    if (!value || value.length === 0) {
      return null;
    }

    return value;
  }

  private roundCurrency(value: number): number {
    return Number(value.toFixed(2));
  }

  private throwMappedError(error: PostgrestError, fallbackMessage: string): never {
    switch (error.code) {
      case '23505':
        throw new RefundConflictError(error.message);
      case '23503':
        throw new RefundForeignKeyError(error.message);
      case '23514':
      case '22001':
      case '22P02':
        throw new RefundConstraintError(error.message);
      default:
        throw new RefundRepositoryError(error.message || fallbackMessage);
    }
  }
}
