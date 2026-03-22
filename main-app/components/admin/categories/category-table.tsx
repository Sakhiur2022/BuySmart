'use client';

import { useMemo, useState } from 'react';
import { MoreHorizontal, Pencil, Power, Search, Trash2 } from 'lucide-react';
import { updateCategoryAction } from '@/lib/actions/category.actions';
import type { Category } from '@/lib/models/category.model';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CategoryDeleteDialog } from '@/components/admin/categories/category-delete-dialog';
import { CategoryFormDialog } from '@/components/admin/categories/category-form-dialog';
import { useRouter } from 'next/navigation';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function truncate(text: string | null, maxLength: number): string {
  if (!text) {
    return '—';
  }

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1)}…`;
}

type CategoryTableProps = {
  categories: Category[];
};

export function CategoryTable({ categories }: CategoryTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [pendingCategoryId, setPendingCategoryId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [deleteCategory, setDeleteCategory] = useState<Category | null>(null);

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.category_id, category])),
    [categories],
  );

  const filteredCategories = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return categories.filter((category) => {
      const matchesSearch =
        normalizedSearch.length === 0 || category.name.toLowerCase().includes(normalizedSearch);

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' ? category.is_active : !category.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [categories, search, statusFilter]);

  const handleToggleStatus = async (category: Category) => {
    setPendingCategoryId(category.category_id);

    const result = await updateCategoryAction(category.category_id, {
      is_active: !category.is_active,
    });

    if (!result.success) {
      setToastMessage(result.error);
      setPendingCategoryId(null);
      return;
    }

    setToastMessage(category.is_active ? 'Category deactivated.' : 'Category activated.');
    setPendingCategoryId(null);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {toastMessage ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {toastMessage}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search category name"
            className="pl-9"
          />
        </div>

        <Select
          value={statusFilter}
          onValueChange={(value: 'all' | 'active' | 'inactive') => setStatusFilter(value)}
        >
          <SelectTrigger className="w-full sm:w-45">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Parent</TableHead>
            <TableHead>Level</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredCategories.length === 0 ? (
            <TableRow>
              <TableCell className="py-6 text-center text-muted-foreground" colSpan={7}>
                No categories found.
              </TableCell>
            </TableRow>
          ) : (
            filteredCategories.map((category) => {
              const parentName = category.parent_category_id
                ? (categoryById.get(category.parent_category_id)?.name ?? 'Unknown')
                : 'Root';
              const isPending = pendingCategoryId === category.category_id;

              return (
                <TableRow key={category.category_id}>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell>{truncate(category.description, 60)}</TableCell>
                  <TableCell>{parentName}</TableCell>
                  <TableCell>
                    <Badge variant="outline">L{category.level ?? 0}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        category.is_active
                          ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
                          : 'border-slate-200 bg-slate-100 text-slate-700'
                      }
                    >
                      {category.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(category.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Open category actions"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <CategoryFormDialog
                          categories={categories}
                          category={category}
                          onSuccessMessage={setToastMessage}
                          trigger={
                            <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
                              <Pencil className="h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                          }
                        />
                        <DropdownMenuItem
                          disabled={isPending}
                          onClick={() => {
                            void handleToggleStatus(category);
                          }}
                        >
                          <Power className="h-4 w-4" />
                          {category.is_active ? 'Toggle Inactive' : 'Toggle Active'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteCategory(category)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <CategoryDeleteDialog
        open={deleteCategory !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteCategory(null);
          }
        }}
        category={deleteCategory}
        onSuccessMessage={setToastMessage}
      />
    </div>
  );
}
