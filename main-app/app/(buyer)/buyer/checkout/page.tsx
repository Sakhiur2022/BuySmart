'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCart } from '@/lib/context/cart-context';

interface CartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

interface AddressForm {
  full_name: string;
  phone: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

type FormErrors = Partial<Record<keyof AddressForm, string>>;

const BD_CITIES = [
  'Dhaka',
  'Chattogram',
  'Khulna',
  'Rajshahi',
  'Sylhet',
  'Barishal',
  'Rangpur',
  'Mymensingh',
];

const POSTAL_REGEX: Record<string, RegExp> = {
  US: /^\d{5}(-\d{4})?$/,
  BD: /^\d{4}$/,
  DEFAULT: /^[A-Z0-9\s\-]{3,10}$/i,
};

function validateAddress(form: AddressForm): FormErrors {
  const errors: FormErrors = {};

  if (!form.full_name.trim()) {
    errors.full_name = 'Full name is required.';
  } else if (form.full_name.trim().length < 2) {
    errors.full_name = 'Name must be at least 2 characters.';
  }

  if (!form.phone.trim()) {
    errors.phone = 'Phone number is required.';
  } else if (form.phone.trim().length < 7) {
    errors.phone = 'Please enter a valid phone number.';
  }

  if (!form.address_line_1.trim()) {
    errors.address_line_1 = 'Street address is required.';
  } else if (form.address_line_1.trim().length < 5) {
    errors.address_line_1 = 'Please enter a complete street address.';
  }

  if (!form.city.trim()) {
    errors.city = 'City is required.';
  }

  if (!form.postal_code.trim()) {
    errors.postal_code = 'Postal code is required.';
  } else {
    const pattern = POSTAL_REGEX[form.country] ?? POSTAL_REGEX.DEFAULT;
    if (!pattern.test(form.postal_code.trim())) {
      errors.postal_code = 'Invalid postal code format for selected country.';
    }
  }

  if (!form.country.trim()) {
    errors.country = 'Country is required.';
  }

  return errors;
}

async function checkStockAvailability(
  supabase: ReturnType<typeof createClient>,
  cartItems: CartItem[],
): Promise<{ ok: boolean; outOfStock: string[] }> {
  const productIds = cartItems.map((i) => i.product_id);

  const { data, error } = await supabase
    .from('products')
    .select('product_id, name, inventory_quantity')
    .in('product_id', productIds);

  if (error || !data) {
    return { ok: false, outOfStock: ['Unable to verify stock. Please try again.'] };
  }

  const outOfStock: string[] = [];
  for (const item of cartItems) {
    const product = data.find((p) => p.product_id === item.product_id);
    if (!product || product.inventory_quantity < item.quantity) {
      outOfStock.push(
        `"${item.product_name}" - requested ${item.quantity}, only ${product?.inventory_quantity ?? 0} available.`,
      );
    }
  }

  return { ok: outOfStock.length === 0, outOfStock };
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-destructive mt-1">{message}</p>;
}

export default function CheckoutPage() {
  const router = useRouter();
  const supabase = createClient();
  const { items, isLoading: isCartLoading, error: cartError } = useCart();

  const cartItems = useMemo<CartItem[]>(
    () =>
      items.map((item) => ({
        product_id: item.product_id,
        product_name: item.product?.name ?? 'Unknown product',
        quantity: item.quantity,
        unit_price: item.product?.price ?? 0,
      })),
    [items],
  );

  const [form, setForm] = useState<AddressForm>({
    full_name: '',
    phone: '',
    address_line_1: '',
    address_line_2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'BD',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [stockErrors, setStockErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash_on_delivery'>('cash_on_delivery');

  const subtotal = cartItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof AddressForm]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGlobalError(null);
    setStockErrors([]);

    const validationErrors = validateAddress(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      if (cartItems.length === 0) {
        setGlobalError('Your cart is empty. Add items before checkout.');
        return;
      }

      const { ok, outOfStock } = await checkStockAvailability(supabase, cartItems);
      if (!ok) {
        setStockErrors(outOfStock);
        setIsSubmitting(false);
        return;
      }

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'cart',
          shipping_address: form,
          payment_method: paymentMethod,
        }),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? 'Order creation failed.');
      }

      const body = (await res.json()) as {
        order?: { order_id?: string; order?: { order_id?: string } };
        order_id?: string;
      };
      const order_id = body.order?.order_id ?? body.order?.order?.order_id ?? body.order_id;

      if (!order_id) {
        throw new Error('Order was created, but no order ID was returned.');
      }

      router.push(`/orders/${order_id}/confirmation`);
    } catch (err: unknown) {
      setGlobalError(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-semibold mb-8">Checkout</h1>

        {stockErrors.length > 0 && (
          <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-destructive">
            <p className="font-medium mb-1">Some items are no longer available:</p>
            <ul className="list-disc pl-4 space-y-1 text-sm">
              {stockErrors.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
            <p className="text-sm mt-2">Update your cart before continuing.</p>
          </div>
        )}

        {globalError && (
          <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {globalError}
          </div>
        )}

        {cartError && (
          <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {cartError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="bg-card text-card-foreground border border-border rounded-lg shadow-sm p-6 mb-6 space-y-5">
            <h2 className="text-base font-medium">Shipping address</h2>

            <div className="space-y-1.5">
              <Label htmlFor="full_name">Full name</Label>
              <Input
                id="full_name"
                name="full_name"
                value={form.full_name}
                onChange={handleChange}
                placeholder="e.g. Sabrina Tabassum"
                aria-invalid={!!errors.full_name}
                className={
                  errors.full_name ? 'border-destructive focus-visible:ring-destructive' : ''
                }
              />
              <FieldError message={errors.full_name} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="e.g. +8801XXXXXXXXX"
                aria-invalid={!!errors.phone}
                className={errors.phone ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              <FieldError message={errors.phone} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="address_line_1">Street address</Label>
              <Input
                id="address_line_1"
                name="address_line_1"
                value={form.address_line_1}
                onChange={handleChange}
                placeholder="e.g. 123 Bashundhara R/A"
                aria-invalid={!!errors.address_line_1}
                className={
                  errors.address_line_1 ? 'border-destructive focus-visible:ring-destructive' : ''
                }
              />
              <FieldError message={errors.address_line_1} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="address_line_2">Address line 2 (optional)</Label>
              <Input
                id="address_line_2"
                name="address_line_2"
                value={form.address_line_2}
                onChange={handleChange}
                placeholder="Apartment, suite, landmark"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <select
                id="city"
                name="city"
                value={form.city}
                onChange={handleChange}
                aria-invalid={!!errors.city}
                className={`w-full h-10 rounded-md border border-input bg-input px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 ${
                  errors.city ? 'border-destructive focus-visible:ring-destructive' : ''
                }`}
              >
                <option value="">Select a city</option>
                {BD_CITIES.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
              <FieldError message={errors.city} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="state">Area/Thana (optional)</Label>
              <Input
                id="state"
                name="state"
                value={form.state}
                onChange={handleChange}
                placeholder="e.g. Gulshan"
              />
              <FieldError message={errors.state} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="postal_code">Postal code</Label>
                <Input
                  id="postal_code"
                  name="postal_code"
                  value={form.postal_code}
                  onChange={handleChange}
                  placeholder="e.g. 1229"
                  aria-invalid={!!errors.postal_code}
                  className={
                    errors.postal_code ? 'border-destructive focus-visible:ring-destructive' : ''
                  }
                />
                <FieldError message={errors.postal_code} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="country">Country</Label>
                <Input id="country" value="Bangladesh" readOnly />
                <FieldError message={errors.country} />
              </div>
            </div>
          </div>

          <div className="bg-card text-card-foreground border border-border rounded-lg shadow-sm p-6 mb-6 space-y-4">
            <h2 className="text-base font-medium">Payment method</h2>
            <div className="flex items-center gap-3 rounded-md border border-border bg-background px-4 py-3">
              <input
                id="payment_cod"
                type="radio"
                name="payment_method"
                value="cash_on_delivery"
                checked={paymentMethod === 'cash_on_delivery'}
                onChange={() => setPaymentMethod('cash_on_delivery')}
                className="h-4 w-4"
              />
              <Label htmlFor="payment_cod" className="cursor-pointer">
                <span className="text-sm font-semibold">Cash on delivery</span>
                <span className="block text-xs text-muted-foreground">Pay when the order arrives.</span>
              </Label>
            </div>
          </div>

          <div className="bg-card text-card-foreground border border-border rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-base font-medium mb-4">Order summary</h2>
            <ul className="space-y-2.5 text-sm mb-4">
              {cartItems.map((item) => (
                <li key={item.product_id} className="flex justify-between">
                  <span className="text-muted-foreground">
                    {item.product_name}
                    <span className="ml-1">× {item.quantity}</span>
                  </span>
                  <span className="font-medium">
                    {(item.unit_price * item.quantity).toLocaleString()} BDT
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex justify-between font-semibold text-sm border-t border-border pt-3">
              <span>Total</span>
              <span>{subtotal.toLocaleString()} BDT</span>
            </div>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting || isCartLoading || cartItems.length === 0}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            size="lg"
          >
            {isSubmitting ? 'Placing order…' : 'Place order'}
          </Button>
        </form>
      </div>
    </div>
  );
}
