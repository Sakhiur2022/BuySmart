import { Boxes, Package, Store, Tag } from 'lucide-react';
import { StatCard } from '@/components/admin/stat-card';
import { fetchCategoryDashboardStats } from '@/lib/controllers/category.controller';

export default async function AdminPage() {
  const stats = await fetchCategoryDashboardStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Marketplace overview for categories, products, and sellers.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Categories"
          value={stats.totalCategories}
          icon={Tag}
          description="All active and inactive categories"
        />
        <StatCard
          label="Active Categories"
          value={stats.activeCategories}
          icon={Boxes}
          description="Available in seller product forms"
        />
        <StatCard
          label="Total Products"
          value={stats.totalProducts}
          icon={Package}
          description="Across all sellers"
        />
        <StatCard
          label="Total Sellers"
          value={stats.totalSellers}
          icon={Store}
          description="Profiles with seller role"
        />
      </div>
    </div>
  );
}
