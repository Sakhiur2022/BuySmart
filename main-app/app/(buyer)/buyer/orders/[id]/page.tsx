import { notFound, redirect } from 'next/navigation';
import { OrderDetailView } from '@/components/orders/order-detail-view';
import { getBuyerOrderById } from '@/lib/services/order.service';
import { createClient } from '@/lib/supabase/server';

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

  try {
    const detail = await getBuyerOrderById(user.id, resolvedParams.id);

    return <OrderDetailView order={detail.order} items={detail.items} />;
  } catch (error) {
    if (error instanceof Error && error.message === 'Order not found') {
      notFound();
    }

    if (error instanceof Error && error.message === 'FORBIDDEN') {
      redirect('/buyer');
    }

    throw error;
  }
}