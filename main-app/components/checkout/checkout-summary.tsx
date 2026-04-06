import type { CartItemWithProduct, UserCartSummary } from '@/lib/models/cart.model';
import { formatCurrency } from '@/lib/utils';

type CheckoutSummaryProps = {
  items: CartItemWithProduct[];
  summary: UserCartSummary;
  shippingCost?: number;
  shippingLabel?: string;
};

export function CheckoutSummary({
  items,
  summary,
  shippingCost = 0,
  shippingLabel = 'Shipping',
}: CheckoutSummaryProps) {
  const subtotal = Number.isFinite(summary.totalAmount) ? summary.totalAmount : 0;
  const totalItems = Number.isFinite(summary.totalItems) ? summary.totalItems : 0;
  const total = subtotal + (Number.isFinite(shippingCost) ? shippingCost : 0);

  return (
    <section aria-labelledby="order-summary-title">
      <header>
        <h2 id="order-summary-title">Order summary</h2>
        <p>Review your items before placing the order.</p>
      </header>

      {items.length === 0 ? (
        <p>Your cart is empty.</p>
      ) : (
        <table>
          <caption>Items in your order</caption>
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col">Qty</th>
              <th scope="col">Unit price</th>
              <th scope="col">Line total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const productName = item.product?.name ?? 'Unavailable product';
              const unitPrice = item.product?.price ?? 0;
              const lineTotal = Number.isFinite(item.line_total)
                ? item.line_total
                : unitPrice * item.quantity;

              return (
                <tr key={item.cart_item_id}>
                  <th scope="row">{productName}</th>
                  <td>{item.quantity}</td>
                  <td>{formatCurrency(unitPrice)}</td>
                  <td>{formatCurrency(lineTotal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <dl>
        <div>
          <dt>Subtotal ({totalItems} items)</dt>
          <dd>{formatCurrency(subtotal)}</dd>
        </div>
        <div>
          <dt>{shippingLabel}</dt>
          <dd>{formatCurrency(shippingCost)}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>{formatCurrency(total)}</dd>
        </div>
      </dl>
    </section>
  );
}
