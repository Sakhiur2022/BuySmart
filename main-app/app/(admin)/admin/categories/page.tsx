import { CategoryFormDialog } from '@/components/admin/categories/category-form-dialog';
import { CategoryTable } from '@/components/admin/categories/category-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAllCategories } from '@/lib/controllers/category.controller';

export default async function AdminCategoriesPage() {
  const categories = await getAllCategories();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Category Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage root and nested categories used across the marketplace.
          </p>
        </div>
        <CategoryFormDialog categories={categories} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <CategoryTable categories={categories} />
        </CardContent>
      </Card>
    </div>
  );
}
