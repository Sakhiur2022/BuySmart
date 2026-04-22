import BuyerRefundRequestForm from '@/components/orders/buyer-refund-request-form';
import BuyerRefundRequestFormShell from '@/components/orders/buyer-refund-request-form-shell';

type BuyerRefundRequestPageProps = {
  params: Promise<{ id: string }>;
};

export default async function BuyerRefundRequestPage({ params }: BuyerRefundRequestPageProps) {
  const resolvedParams = await params;

  return (
    <BuyerRefundRequestFormShell>
      <BuyerRefundRequestForm orderId={resolvedParams.id} />
    </BuyerRefundRequestFormShell>
  );
}