'use client';

import { useMemo, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { createCategoryAction, updateCategoryAction } from '@/lib/actions/category.actions';
import type { Category } from '@/lib/models/category.model';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useRouter } from 'next/navigation';

type CategoryFormDialogProps = {
  categories: Category[];
  category?: Category;
  trigger?: React.ReactNode;
  onSuccessMessage?: (message: string) => void;
};

export function CategoryFormDialog({
  categories,
  category,
  trigger,
  onSuccessMessage,
}: CategoryFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(category?.name ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [parentCategoryId, setParentCategoryId] = useState(
    category?.parent_category_id ? String(category.parent_category_id) : 'none',
  );
  const [isActive, setIsActive] = useState(category?.is_active ?? true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableParentCategories = useMemo(
    () =>
      categories.filter(
        (item) => item.is_active && (category ? item.category_id !== category.category_id : true),
      ),
    [categories, category],
  );

  const mode = category ? 'edit' : 'create';

  const resetState = () => {
    setName(category?.name ?? '');
    setDescription(category?.description ?? '');
    setParentCategoryId(
      category?.parent_category_id ? String(category.parent_category_id) : 'none',
    );
    setIsActive(category?.is_active ?? true);
    setError(null);
    setIsSubmitting(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetState();
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (mode === 'edit' && !category) {
      setError('Category not found. Please refresh and try again.');
      setIsSubmitting(false);
      return;
    }

    const editableCategory = category;

    const payload = {
      name,
      description: description.trim() ? description : null,
      parent_category_id: parentCategoryId === 'none' ? null : Number(parentCategoryId),
      ...(mode === 'edit' ? { is_active: isActive } : {}),
    };

    const result =
      mode === 'create'
        ? await createCategoryAction(payload)
        : await updateCategoryAction(editableCategory!.category_id, payload);

    if (!result.success) {
      setError(result.error);
      setIsSubmitting(false);
      return;
    }

    onSuccessMessage?.(
      mode === 'create' ? 'Category created successfully.' : 'Category updated successfully.',
    );
    setOpen(false);
    setIsSubmitting(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Category
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add Category' : 'Edit Category'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Create a root category or a child category under an existing parent.'
              : 'Update category details and availability.'}
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="category-name">Name</Label>
            <Input
              id="category-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="category-description">Description</Label>
            <Textarea
              id="category-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={500}
              className="min-h-20"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="parent-category">Parent Category</Label>
            <Select value={parentCategoryId} onValueChange={setParentCategoryId}>
              <SelectTrigger id="parent-category">
                <SelectValue placeholder="Select parent category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Root</SelectItem>
                {availableParentCategories.map((parent) => (
                  <SelectItem key={parent.category_id} value={String(parent.category_id)}>
                    {parent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {mode === 'edit' ? (
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Active Status</p>
                <p className="text-xs text-muted-foreground">
                  Inactive categories are hidden from seller product forms.
                </p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          ) : null}

          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : mode === 'create' ? (
                'Create Category'
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
