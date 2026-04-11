import type {
  Category,
  CategoryDashboardStats,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '@/lib/models/category.model';
import {
  create,
  findAll,
  findAllActive,
  findById,
  getDashboardStats,
  hasActiveProductReferences,
  nameExistsUnderParent,
  softDelete,
  update,
} from '@/lib/repositories/category.repository';

function getNormalizedName(name: string): string {
  return name.trim().toLowerCase();
}

async function resolveLevelAndParent(parentCategoryId: number | null | undefined): Promise<number> {
  if (parentCategoryId === null || parentCategoryId === undefined) {
    return 0;
  }

  const parent = await findById(parentCategoryId);

  if (!parent) {
    throw new Error('Parent category does not exist');
  }

  return (parent.level ?? 0) + 1;
}

export async function getAllCategories(): Promise<Category[]> {
  return findAll();
}

export async function getActiveCategories(): Promise<Category[]> {
  return findAllActive();
}

export async function getCategoryById(id: number): Promise<Category | null> {
  return findById(id);
}

export async function createCategory(input: CreateCategoryInput): Promise<Category> {
  const trimmedName = input.name.trim();

  if (trimmedName.length < 2) {
    throw new Error('Category name must be at least 2 characters');
  }

  const parentCategoryId = input.parent_category_id ?? null;
  const duplicateExists = await nameExistsUnderParent(trimmedName, parentCategoryId);

  if (duplicateExists) {
    throw new Error('A category with this name already exists under the selected parent');
  }

  const level = await resolveLevelAndParent(parentCategoryId);

  return create({
    name: trimmedName,
    description: input.description ?? null,
    parent_category_id: parentCategoryId,
    level,
  });
}

export async function updateCategory(id: number, input: UpdateCategoryInput): Promise<Category> {
  const existing = await findById(id);

  if (!existing) {
    throw new Error('Category not found');
  }

  const nextName = input.name !== undefined ? input.name.trim() : existing.name;
  const nextParentId =
    input.parent_category_id !== undefined ? input.parent_category_id : existing.parent_category_id;

  if (getNormalizedName(nextName).length < 2) {
    throw new Error('Category name must be at least 2 characters');
  }

  if (nextParentId === id) {
    throw new Error('A category cannot be its own parent');
  }

  const duplicateExists = await nameExistsUnderParent(nextName, nextParentId ?? null, id);

  if (duplicateExists) {
    throw new Error('A category with this name already exists under the selected parent');
  }

  const level = await resolveLevelAndParent(nextParentId ?? null);

  return update(id, {
    ...input,
    name: nextName,
    parent_category_id: nextParentId ?? null,
    level,
  });
}

export async function softDeleteCategory(id: number): Promise<void> {
  const category = await findById(id);

  if (!category) {
    throw new Error('Category not found');
  }

  const referencedByProducts = await hasActiveProductReferences(id);

  if (referencedByProducts) {
    throw new Error('Cannot deactivate category with active products');
  }

  await softDelete(id);
}

export async function getCategoryDashboardStats(): Promise<CategoryDashboardStats> {
  return getDashboardStats();
}
