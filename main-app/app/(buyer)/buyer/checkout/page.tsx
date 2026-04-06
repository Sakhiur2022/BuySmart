"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  stock: number;
}

interface AddressForm {
  full_name: string;
  street_address: string;
  city: string;
  postal_code: string;
  country: string;
}

type FormErrors = Partial<Record<keyof AddressForm, string>>;

const POSTAL_REGEX: Record<string, RegExp> = {
  US: /^\d{5}(-\d{4})?$/,
  BD: /^\d{4}$/,
  DEFAULT: /^[A-Z0-9\s\-]{3,10}$/i,
};

function validateAddress(form: AddressForm): FormErrors {
  const errors: FormErrors = {};

  if (!form.full_name.trim()) {
    errors.full_name = "Full name is required.";
  } else if (form.full_name.trim().length < 2) {
    errors.full_name = "Name must be at least 2 characters.";
  }

  if (!form.street_address.trim()) {
    errors.street_address = "Street address is required.";
  } else if (form.street_address.trim().length < 5) {
    errors.street_address = "Please enter a complete street address.";
  }

  if (!form.city.trim()) {
    errors.city = "City is required.";
  }

  if (!form.postal_code.trim()) {
    errors.postal_code = "Postal code is required.";
  } else {
    const pattern = POSTAL_REGEX[form.country] ?? POSTAL_REGEX.DEFAULT;
    if (!pattern.test(form.postal_code.trim())) {
      errors.postal_code = "Invalid postal code format for selected country.";
    }
  }

  if (!form.country.trim()) {
    errors.country = "Country is required.";
  }

  return errors;
}

async function checkStockAvailability(
  supabase: ReturnType<typeof createClientComponentClient>,
  cartItems: CartItem[]
): Promise<{ ok: boolean; outOfStock: string[] }> {
  const productIds = cartItems.map((i) => i.product_id);

  const { data, error } = await supabase
    .from("products")
    .select("id, title, stock")
    .in("id", productIds);

  if (error || !data) {
    return { ok: false, outOfStock: ["Unable to verify stock. Please try again."] };
  }

  const outOfStock: string[] = [];
  for (const item of cartItems) {
    const product = data.find((p) => p.id === item.product_id);
    if (!product || product.stock < item.quantity) {
      outOfStock.push(
        `"${item.product_name}" — requested ${item.quantity}, only ${product?.stock ?? 0} available.`
      );
    }
  }

  return { ok: outOfStock.length === 0, outOfStock };
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-destructive mt-1">{message}</p>;
}

interface CheckoutPageProps {
  cartItems: CartItem[];
}

export default function CheckoutPage({ cartItems }: CheckoutPageProps) {
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [form, setForm] = useState<AddressForm>({
    full_name: "",
    street_address: "",
    city: "",
    postal_code: "",
    country: "BD",
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [stockErrors, setStockErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0
  );

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
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
      const { ok, outOfStock } = await checkStockAvailability(supabase, cartItems);
      if (!ok) {
        setStockErrors(outOfStock);
        setIsSubmitting(false);
        return;
      }

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipping_address: form,
          items: cartItems.map((i) => ({
            product_id: i.product_id,
            quantity: i.quantity,
            unit_price: i.unit_price,
          })),
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message ?? "Order creation failed.");
      }

      const { order_id } = await res.json();
      router.push(`/orders/${order_id}/confirmation`);
    } catch (err: unknown) {
      setGlobalError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
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
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>
              <p className="font-medium mb-1">Some items are no longer available:</p>
              <ul className="list-disc pl-4 space-y-1 text-sm">
                {stockErrors.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
              <p className="text-sm mt-2">Update your cart before continuing.</p>
            </AlertDescription>
          </Alert>
        )}

        {globalError && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{globalError}</AlertDescription>
          </Alert>
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
                  errors.full_name
                    ? "border-destructive focus-visible:ring-destructive"
                    : ""
                }
              />
              <FieldError message={errors.full_name} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="street_address">Street address</Label>
              <Input
                id="street_address"
                name="street_address"
                value={form.street_address}
                onChange={handleChange}
                placeholder="e.g. 123 Bashundhara R/A"
                aria-invalid={!!errors.street_address}
                className={
                  errors.street_address
                    ? "border-destructive focus-visible:ring-destructive"
                    : ""
                }
              />
              <FieldError message={errors.street_address} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                name="city"
                value={form.city}
                onChange={handleChange}
                placeholder="e.g. Dhaka"
                aria-invalid={!!errors.city}
                className={
                  errors.city
                    ? "border-destructive focus-visible:ring-destructive"
                    : ""
                }
              />
              <FieldError message={errors.city} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="postal_code">Postal code</Label>
                <Input
                  id="postal_code"
                  name="postal_code"
                  value={form.postal_code}
                  onChange={handleChange}
                  placeholder={form.country === "BD" ? "e.g. 1229" : "e.g. 10001"}
                  aria-invalid={!!errors.postal_code}
                  className={
                    errors.postal_code
                      ? "border-destructive focus-visible:ring-destructive"
                      : ""
                  }
                />
                <FieldError message={errors.postal_code} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="country">Country</Label>
                <select
                  id="country"
                  name="country"
                  value={form.country}
                  onChange={handleChange}
                  className="w-full h-10 rounded-md border border-input bg-input px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0"
                >
                  <option value="BD">Bangladesh</option>
                  <option value="US">United States</option>
                </select>
                <FieldError message={errors.country} />
              </div>
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
            disabled={isSubmitting || cartItems.length === 0}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            size="lg"
          >
            {isSubmitting ? "Placing order…" : "Place order"}
          </Button>
        </form>
      </div>
    </div>
  );
}
