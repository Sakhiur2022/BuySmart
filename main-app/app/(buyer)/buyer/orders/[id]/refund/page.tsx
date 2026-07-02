import BuyerRefundRequestForm from '@/components/orders/buyer-refund-request-form';
import BuyerRefundRequestFormShell from '@/components/orders/buyer-refund-request-form-shell';

type BuyerRefundRequestPageProps = {
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

export default async function BuyerRefundRequestPage({
  params,
  searchParams,
}: BuyerRefundRequestPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const refundGuide = getSearchValue(resolvedSearchParams?.guide) === 'refund';

  return (
    <BuyerRefundRequestFormShell refundGuide={refundGuide}>
      <BuyerRefundRequestForm orderId={resolvedParams.id} refundGuide={refundGuide} />
    </BuyerRefundRequestFormShell>
  );
}
