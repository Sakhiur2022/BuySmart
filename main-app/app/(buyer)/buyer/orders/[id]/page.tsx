import { notFound, redirect } from 'next/navigation';
import { OrderDetailView } from '@/components/orders/order-detail-view';
import { getBuyerOrderById } from '@/lib/services/order.service';
import {
  getBuyerRefundDetailForUser,
  listBuyerRefundsForUser,
} from '@/lib/services/refund.service';
import { createClient } from '@/lib/supabase/server';
import type { RefundDetailDTO } from '@/lib/types/refund.types';

type BuyerOrderDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    guide?: string | string[];
  }>;
};

function getSearchValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export default async function BuyerOrderDetailPage({
  params,
  searchParams,
}: BuyerOrderDetailPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const resolvedParams = await params;
  let detail: Awaited<ReturnType<typeof getBuyerOrderById>>;
  let refundDetail: RefundDetailDTO | null = null;

  try {
    detail = await getBuyerOrderById(user.id, resolvedParams.id);
  } catch (error) {
    if (error instanceof Error && error.message === 'Order not found') {
      notFound();
    }

    if (error instanceof Error && error.message === 'FORBIDDEN') {
      redirect('/buyer');
    }

    throw error;
  }

  try {
    const refundResult = await listBuyerRefundsForUser(user.id, {
      page: 1,
      pageSize: 1,
      sortBy: 'recent',
      order_id: resolvedParams.id,
    });

    const latestRefund = refundResult.refunds[0];
    if (latestRefund) {
      refundDetail = await getBuyerRefundDetailForUser(user.id, latestRefund.refund_id);
    }
  } catch (error) {
    console.error('Failed to load refund detail for buyer order page.', error);
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const refundGuide = getSearchValue(resolvedSearchParams?.guide) === 'refund';

  return (
    <OrderDetailView
      order={detail.order}
      items={detail.items}
      feedbackByOrderItemId={detail.feedbackByOrderItemId}
      refundDetail={refundDetail}
      refundGuide={refundGuide}
    />
  );
}
