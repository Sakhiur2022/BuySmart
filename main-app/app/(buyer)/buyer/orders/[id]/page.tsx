import { notFound, redirect } from 'next/navigation';
import { OrderDetailView } from '@/components/orders/order-detail-view';
import { getBuyerOrderById } from '@/lib/services/order.service';
import { getRefundDetailForUser, listRefundsForUser } from '@/lib/services/refund.service';
import { createClient } from '@/lib/supabase/server';
import type { RefundDetailDTO } from '@/lib/types/refund.types';

type BuyerOrderDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function BuyerOrderDetailPage({ params }: BuyerOrderDetailPageProps) {
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
    const refundResult = await listRefundsForUser(user.id, {
      page: 1,
      pageSize: 1,
      sortBy: 'recent',
      order_id: resolvedParams.id,
    });

    const latestRefund = refundResult.refunds[0];
    if (latestRefund) {
      refundDetail = await getRefundDetailForUser(user.id, latestRefund.refund_id);
    }
  } catch (error) {
    console.error('Failed to load refund detail for buyer order page.', error);
  }

  return (
    <OrderDetailView
      order={detail.order}
      items={detail.items}
      feedbackByOrderItemId={detail.feedbackByOrderItemId}
      refundDetail={refundDetail}
    />
  );
}