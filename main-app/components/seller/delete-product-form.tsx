'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type DeleteProductFormProps = {
  productId: string;
  productName?: string;
  returnTo?: string;
};

export function DeleteProductForm({
  productId,
  productName,
  returnTo = '/seller/products',
}: DeleteProductFormProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData();
    formData.append('product_id', productId);
    formData.append('return_to', returnTo);

    const form = e.currentTarget;
    form.submit();
  };

  return (
    <>
      <Button
        type="button"
        size="xs"
        variant="destructive"
        onClick={() => setOpen(true)}
      >
        Delete
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{productName ? ` "${productName}"` : ' this product'}?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <form action="/seller/products/delete" method="post" onSubmit={handleSubmit}>
              <input type="hidden" name="product_id" value={productId} />
              <input type="hidden" name="return_to" value={returnTo} />
              <Button
                type="submit"
                variant="destructive"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Deleting...' : 'Delete'}
              </Button>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
