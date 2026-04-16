import { redirect } from 'next/navigation';

type OrderRedirectPageProps = {
  params: Promise<{ order_id: string }>;
};

export default async function OrderRedirectPage({ params }: OrderRedirectPageProps) {
  const resolvedParams = await params;
  redirect(`/buyer/orders/${resolvedParams.order_id}`);
}
