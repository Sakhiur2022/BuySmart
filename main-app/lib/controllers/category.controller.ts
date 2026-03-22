import type {
  Category,
  CategoryDashboardStats,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '@/lib/models/category.model';
import {
  createCategory as createCategoryService,
  getActiveCategories as getActiveCategoriesService,
  getAllCategories as getAllCategoriesService,
  getCategoryById as getCategoryByIdService,
  getCategoryDashboardStats,
  softDeleteCategory as softDeleteCategoryService,
  updateCategory as updateCategoryService,
} from '@/lib/services/category.service';

export async function fetchCategoryDashboardStats(): Promise<CategoryDashboardStats> {
  return getCategoryDashboardStats();
}

export async function getAllCategories(): Promise<Category[]> {
  return getAllCategoriesService();
}

export async function getActiveCategories(): Promise<Category[]> {
  return getActiveCategoriesService();
}

export async function getCategoryById(id: number): Promise<Category | null> {
  return getCategoryByIdService(id);
}

export async function createCategory(input: CreateCategoryInput): Promise<Category> {
  return createCategoryService(input);
}

export async function updateCategory(id: number, input: UpdateCategoryInput): Promise<Category> {
  return updateCategoryService(id, input);
}

export async function softDeleteCategory(id: number): Promise<void> {
  await softDeleteCategoryService(id);
}
