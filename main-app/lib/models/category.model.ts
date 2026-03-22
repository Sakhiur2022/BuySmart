export interface Category {
  category_id: number;
  name: string;
  description: string | null;
  parent_category_id: number | null;
  level: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type CreateCategoryInput = {
  name: string;
  description?: string | null;
  parent_category_id?: number | null;
  level?: number | null;
};

export type UpdateCategoryInput = Partial<CreateCategoryInput> & {
  is_active?: boolean;
};

export type CategoryDashboardStats = {
  totalCategories: number;
  activeCategories: number;
  totalProducts: number;
  totalSellers: number;
};
