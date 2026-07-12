import { ProductForm } from '@/components/forms/product-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import type { Category } from '@/lib/models/category.model';
import type { SellerListingPreview } from '@/lib/chatbot/types';
import { getSellerListingFieldSummary } from '@/lib/chatbot/seller-listing-draft';

export type SellerListingPreviewCardProps = {
  preview: SellerListingPreview;
  categories?: Category[];
  action?: (formData: FormData) => void | Promise<void>;
  onCreate: () => void;
  onClear: () => void;
  isSubmitting?: boolean;
};

function formatCurrency(amount: number | null) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return 'BDT --';
  }

  return `BDT ${amount.toLocaleString('en-US')}`;
}

export function SellerListingPreviewCard({
  preview,
  categories = [],
  action,
  onCreate,
  onClear,
  isSubmitting = false,
}: SellerListingPreviewCardProps) {
  const selectedCategory = categories.find(
    (category) => category.name.trim().toLowerCase() === preview.category.trim().toLowerCase(),
  );
  const canRenderInlineEditor = Boolean(action && categories.length > 0);

  if (canRenderInlineEditor && action) {
    return (
      <div className="space-y-3">
        <ProductForm
          title="Edit listing draft"
          description="Adjust the fields below, then publish the product without leaving chat."
          submitLabel="Create Product"
          action={action}
          categories={categories}
          isLocked={preview.status === 'created'}
          lockedMessage="This product has been published. The form is locked to prevent further edits from chat."
          lockOnSubmit
          values={{
            categoryId: selectedCategory?.category_id ?? null,
            name: preview.name,
            price: preview.price ?? 0,
            inventoryQuantity: preview.stockQuantity ?? 0,
            status: preview.status === 'created' || preview.missingFields.length === 0 ? 'active' : 'draft',
            shortDescription: '',
            description: '',
            imageUrls: preview.photos,
          }}
        />
        {preview.status !== 'created' ? (
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={onClear} disabled={isSubmitting}>
              Clear draft
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  const hasPhotos = preview.photos.length > 0;
  const fieldSummary = getSellerListingFieldSummary({
    name: preview.name,
    price: preview.price,
    category: preview.category,
    photos: preview.photos,
    stockQuantity: preview.stockQuantity,
  });

  return (
    <Card className="border-rose-100 bg-gradient-to-br from-white via-rose-50/60 to-orange-50/70 shadow-[0_14px_40px_rgba(244,63,94,0.08)]">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-500/80">
              Listing preview
            </p>
            <CardTitle className="mt-1 text-lg">Review the draft before publishing</CardTitle>
          </div>
          <Badge
            className={
              preview.status === 'created'
                ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
                : preview.missingFields.length === 0
                  ? 'border-sky-200 bg-sky-100 text-sky-700'
                  : 'border-amber-200 bg-amber-100 text-amber-700'
            }
          >
            {preview.status === 'created'
              ? 'Created'
              : preview.missingFields.length === 0
                ? 'Ready'
                : 'Draft'}
          </Badge>
        </div>
        <p className="text-sm leading-6 text-slate-600">
          The bot is collecting the details for your listing. When everything looks right, tap
          Create listing.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {fieldSummary.map((item) => (
            <div
              key={item.field}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/80 bg-white/85 px-3 py-2 shadow-sm"
            >
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {item.label}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {item.field === 'price'
                    ? formatCurrency(item.value as number | null)
                    : item.field === 'photos'
                      ? `${preview.photos.length} photo${preview.photos.length === 1 ? '' : 's'}`
                      : item.value || 'Waiting'}
                </p>
              </div>
              <Badge
                className={
                  item.ready
                    ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
                    : 'border-slate-200 bg-slate-100 text-slate-500'
                }
              >
                {item.ready ? 'Set' : 'Missing'}
              </Badge>
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/80 bg-white/85 p-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Product
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {preview.name.trim() || 'Waiting for a name'}
            </p>
          </div>
          <div className="rounded-xl border border-white/80 bg-white/85 p-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Price
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatCurrency(preview.price)}
            </p>
          </div>
          <div className="rounded-xl border border-white/80 bg-white/85 p-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Category
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {preview.category.trim() || 'Waiting for a category'}
            </p>
          </div>
          <div className="rounded-xl border border-white/80 bg-white/85 p-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Stock
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {typeof preview.stockQuantity === 'number' ? preview.stockQuantity : '--'}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-white/80 bg-white/85 p-3 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Photos
            </p>
            <p className="text-xs text-slate-500">{preview.photos.length}/10</p>
          </div>
          {hasPhotos ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {preview.photos.slice(0, 3).map((photo, index) => (
                <Badge key={`${photo}-${index}`} className="border-sky-200 bg-sky-50 text-sky-700">
                  Photo {index + 1}
                </Badge>
              ))}
              {preview.photos.length > 3 ? (
                <Badge className="border-slate-200 bg-slate-100 text-slate-600">
                  +{preview.photos.length - 3} more
                </Badge>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No photo URLs yet.</p>
          )}
        </div>

        {preview.missingFields.length > 0 ? (
          <div className="rounded-xl border border-amber-100 bg-amber-50/90 px-3 py-2 text-sm text-amber-800">
            Still needed: {preview.missingFields.join(', ')}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button asChild type="button" variant="outline">
            <Link href="/seller/products/new">Edit in product form</Link>
          </Button>
          <Button
            type="button"
            onClick={onCreate}
            disabled={isSubmitting || preview.missingFields.length > 0 || preview.status === 'created'}
            className="bg-rose-500 text-white hover:bg-rose-600 disabled:bg-rose-300"
          >
            {isSubmitting ? 'Publishing...' : preview.status === 'created' ? 'Published' : 'Create listing'}
          </Button>
          <Button type="button" variant="outline" onClick={onClear} disabled={isSubmitting}>
            Clear draft
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
