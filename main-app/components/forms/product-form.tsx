import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type ProductFormValues = {
  productId?: string;
  name: string;
  price: number;
  inventoryQuantity: number;
  status: 'draft' | 'active' | 'inactive' | 'out_of_stock';
  shortDescription: string;
  description: string;
  imageUrl: string;
};

type ProductFormProps = {
  title: string;
  description: string;
  submitLabel: string;
  action: (formData: FormData) => void | Promise<void>;
  values?: Partial<ProductFormValues>;
};

const DEFAULT_VALUES: ProductFormValues = {
  name: '',
  price: 0,
  inventoryQuantity: 0,
  status: 'active',
  shortDescription: '',
  description: '',
  imageUrl: '',
};

export function ProductForm({ title, description, submitLabel, action, values }: ProductFormProps) {
  const formValues = {
    ...DEFAULT_VALUES,
    ...values,
  };

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-5">
          {formValues.productId ? (
            <input type="hidden" name="product_id" value={formValues.productId} />
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="name">Product Name</Label>
            <Input
              id="name"
              name="name"
              placeholder="Premium Laptop Pro"
              defaultValue={formValues.name}
              required
              maxLength={255}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="price">Price (USD)</Label>
              <Input
                id="price"
                name="price"
                type="number"
                step="0.01"
                min="0"
                defaultValue={formValues.price}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="inventory_quantity">Stock</Label>
              <Input
                id="inventory_quantity"
                name="inventory_quantity"
                type="number"
                step="1"
                min="0"
                defaultValue={formValues.inventoryQuantity}
                required
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              name="status"
              defaultValue={formValues.status}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="inactive">Inactive</option>
              <option value="out_of_stock">Out of Stock</option>
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="image_url">Primary Image URL</Label>
            <Input
              id="image_url"
              name="image_url"
              type="url"
              placeholder="https://images.example.com/product.jpg"
              defaultValue={formValues.imageUrl}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="short_description">Short Description</Label>
            <Textarea
              id="short_description"
              name="short_description"
              placeholder="Short product summary"
              defaultValue={formValues.shortDescription}
              className="min-h-20"
              maxLength={500}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Full Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Detailed product description"
              defaultValue={formValues.description}
              className="min-h-32"
              maxLength={4000}
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <Button asChild variant="outline" type="button">
              <Link href="/seller/products">Cancel</Link>
            </Button>
            <Button type="submit">{submitLabel}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
