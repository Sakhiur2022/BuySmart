'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { softDeleteCategoryAction } from '@/lib/actions/category.actions';
import type { Category } from '@/lib/models/category.model';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useRouter } from 'next/navigation';

type CategoryDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category | null;
  onSuccessMessage?: (message: string) => void;
};

export function CategoryDeleteDialog({
  open,
  onOpenChange,
  category,
  onSuccessMessage,
}: CategoryDeleteDialogProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!category) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const result = await softDeleteCategoryAction(category.category_id);

    if (!result.success) {
      setError(result.error);
      setIsSubmitting(false);
      return;
    }

    onSuccessMessage?.('Category deactivated successfully.');
    setIsSubmitting(false);
    onOpenChange(false);
    router.refresh();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deactivate Category</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to deactivate{' '}
            <span className="font-semibold text-foreground">
              {category?.name ?? 'this category'}
            </span>
            ? Sellers will no longer see it in product forms.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isSubmitting}
            onClick={(event) => {
              event.preventDefault();
              void handleConfirm();
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deactivating...
              </>
            ) : (
              'Deactivate'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
