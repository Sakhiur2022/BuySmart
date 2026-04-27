import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import BuyerRefundDetailSection from '@/components/orders/buyer-refund-detail-section';
import { Button } from '@/components/ui/button';
import { getBuyerRefundDetailForUser } from '@/lib/services/refund.service';
import { createClient } from '@/lib/supabase/server';
import type { RefundDetailDTO } from '@/lib/types/refund.types';

type BuyerRefundDetailPageProps = {
  params: Promise<{ refund_id: string }>;
};

export default async function BuyerRefundDetailPage({ params }: BuyerRefundDetailPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const resolvedParams = await params;
  let refund: RefundDetailDTO;

  try {
    refund = await getBuyerRefundDetailForUser(user.id, resolvedParams.refund_id);
  } catch (error) {
    if (error instanceof Error && error.message === 'Refund not found') {
      notFound();
    }

    if (error instanceof Error && error.message === 'FORBIDDEN') {
      redirect('/buyer');
    }

    throw error;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Refund details</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{refund.refund_number}</h1>
          <p className="text-sm text-muted-foreground">Order ID {refund.order_id.slice(0, 8)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/buyer">Back to dashboard</Link>
          </Button>
          <Button asChild size="sm">
            <Link href={`/buyer/orders/${refund.order_id}`}>View order</Link>
          </Button>
        </div>
      </div>

      <BuyerRefundDetailSection refund={refund} />
    </div>
  );
}
