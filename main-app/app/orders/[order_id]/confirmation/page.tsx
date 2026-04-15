import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';

interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

interface ShippingAddress {
  full_name: string;
  phone: string;
  address_line_1: string;
  address_line_2?: string | null;
  city: string;
  state?: string | null;
  postal_code?: string | null;
  country: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const COUNTRY_LABELS: Record<string, string> = {
  BD: 'Bangladesh',
  US: 'United States',
};

async function getOrder(orderId: string) {
  const supabase = await createClient();

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('order_id, created_at, status, shipping_address')
    .eq('order_id', orderId)
    .single();

  if (orderError || !order) {
    return null;
  }

  const { data: rawItems, error: itemsError } = await supabase
    .from('order_items')
    .select('product_id, quantity, unit_price, product_snapshot')
    .eq('order_id', orderId);

  if (itemsError || !rawItems) {
    return {
      order,
      items: [] as OrderItem[],
    };
  }

  const items: OrderItem[] = rawItems.map((item) => {
    const productSnapshot = item.product_snapshot as {
      name?: string;
    } | null;

    return {
      product_id: item.product_id,
      product_name: productSnapshot?.name ?? 'Product',
      quantity: item.quantity,
      unit_price: item.unit_price,
    };
  });

  return { order, items };
}

interface PageProps {
  params: Promise<{
    order_id: string;
  }>;
}

export default async function OrderConfirmationPage({ params }: PageProps) {
  const { order_id } = await params;
  const fetched = await getOrder(order_id);
  if (!fetched) {
    notFound();
  }

  const { order, items } = fetched;
  const shippingAddress = (order.shipping_address as ShippingAddress | null) ?? {
    full_name: '',
    phone: '',
    address_line_1: '',
    city: '',
    postal_code: '',
    country: '',
  };

  const subtotal = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-full bg-[color:var(--chart-3)]/15 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-7 h-7 text-[color:var(--chart-3)]"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold">Order confirmed!</h1>
          <p className="text-muted-foreground text-sm mt-1.5">
            A confirmation email has been sent to your registered address.
          </p>
        </div>

        <div className="bg-card text-card-foreground border border-border rounded-lg shadow-sm p-5 mb-5 grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
          <div>
            <p className="text-muted-foreground mb-0.5 text-xs">Order ID</p>
            <p className="font-mono font-medium text-xs break-all">{order.order_id}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-0.5 text-xs">Date placed</p>
            <p className="font-medium">{formatDate(order.created_at)}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-0.5 text-xs">Status</p>
            <span className="inline-block bg-secondary text-secondary-foreground text-xs font-medium px-2.5 py-0.5 rounded-full">
              {order.status}
            </span>
          </div>
        </div>

        <div className="bg-card text-card-foreground border border-border rounded-lg shadow-sm p-5 mb-5">
          <h2 className="text-sm font-medium mb-3">Items ordered</h2>
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.product_id} className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {item.product_name}
                  <span className="ml-1 text-xs">× {item.quantity}</span>
                </span>
                <span className="font-medium">
                  {(item.unit_price * item.quantity).toLocaleString()} BDT
                </span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between font-semibold text-sm border-t border-border mt-4 pt-3">
            <span>Total</span>
            <span>{subtotal.toLocaleString()} BDT</span>
          </div>
        </div>

        <div className="bg-card text-card-foreground border border-border rounded-lg shadow-sm p-5 mb-8 text-sm">
          <h2 className="font-medium mb-3">Shipping to</h2>
          <div className="space-y-2 text-sm">
            <div>
              <p className="text-muted-foreground text-xs font-medium mb-0.5">Name</p>
              <p>{shippingAddress.full_name}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium mb-0.5">Phone</p>
              <p>{shippingAddress.phone}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium mb-0.5">Address</p>
              <address className="not-italic">
                {shippingAddress.address_line_1}
                {shippingAddress.address_line_2 && (
                  <>
                    <br />
                    {shippingAddress.address_line_2}
                  </>
                )}
              </address>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium mb-0.5">City/Area</p>
              <p>{shippingAddress.city}{shippingAddress.state && `, ${shippingAddress.state}`}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium mb-0.5">Postal Code</p>
              <p>{shippingAddress.postal_code}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium mb-0.5">Country</p>
              <p>{COUNTRY_LABELS[shippingAddress.country] ?? shippingAddress.country}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
            <Link href={`/orders/${order.order_id}`}>Track this order</Link>
          </Button>

          <Button asChild variant="outline" className="flex-1">
            <Link href="/products">Continue shopping</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
