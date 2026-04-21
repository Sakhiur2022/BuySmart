'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition, type FormEvent } from 'react';
import { MultiImageUpload } from '@/components/seller/multi-image-upload';
import type { Category } from '@/lib/models/category.model';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type ProductFormValues = {
  productId?: string;
  categoryId?: number | null;
  name: string;
  price: number;
  inventoryQuantity: number;
  status: 'draft' | 'active' | 'inactive' | 'out_of_stock';
  shortDescription: string;
  description: string;
  imageUrls: string[];
};

type ProductImageOrderRef = { kind: 'existing'; value: string } | { kind: 'new'; value: string };

type ProductImageUploadState = {
  imageOrder: ProductImageOrderRef[];
  newUploads: Array<{
    token: string;
    file: File;
  }>;
};

type ProductFormProps = {
  title: string;
  description: string;
  submitLabel: string;
  action: (formData: FormData) => void | Promise<void>;
  categories: Category[];
  values?: Partial<ProductFormValues>;
};

const DEFAULT_VALUES: ProductFormValues = {
  name: '',
  price: 0,
  inventoryQuantity: 0,
  status: 'active',
  shortDescription: '',
  description: '',
  imageUrls: [],
};

function createInitialImageUploadState(imageUrls: string[]): ProductImageUploadState {
  return {
    imageOrder: imageUrls.map((url) => ({ kind: 'existing', value: url })),
    newUploads: [],
  };
}

export function ProductForm({
  title,
  description,
  submitLabel,
  action,
  categories,
  values,
}: ProductFormProps) {
  const formValues = {
    ...DEFAULT_VALUES,
    ...values,
  };
  const [isSubmitting, startTransition] = useTransition();
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    formValues.categoryId ? String(formValues.categoryId) : 'none',
  );
  const [imageUploadState, setImageUploadState] = useState<ProductImageUploadState>(() =>
    createInitialImageUploadState(formValues.imageUrls),
  );
  const categoryOptions = useMemo(
    () =>
      categories.map((category) => ({ id: String(category.category_id), label: category.name })),
    [categories],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    formData.set('image_order', JSON.stringify(imageUploadState.imageOrder));

    for (const upload of imageUploadState.newUploads) {
      formData.append('new_image_tokens', upload.token);
      formData.append('new_images', upload.file);
    }

    startTransition(() => {
      void action(formData);
    });
  };

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-5">
          {formValues.productId ? (
            <input type="hidden" name="product_id" value={formValues.productId} />
          ) : null}
          <input
            type="hidden"
            name="category_id"
            value={selectedCategoryId === 'none' ? '' : selectedCategoryId}
          />

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
              <Label htmlFor="price">Price (BDT)</Label>
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
            <Label htmlFor="category_id">Category</Label>
            <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
              <SelectTrigger id="category_id">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No category</SelectItem>
                {categoryOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

          <MultiImageUpload
            initialImageUrls={formValues.imageUrls}
            submitting={isSubmitting}
            onChange={setImageUploadState}
          />

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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : submitLabel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
