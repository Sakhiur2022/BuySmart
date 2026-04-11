import type {
  Category,
  CategoryDashboardStats,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '@/lib/models/category.model';
import { createClient } from '@/lib/supabase/server';

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export async function findAll(): Promise<Category[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('level', { ascending: true, nullsFirst: true })
    .order('name', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Category[];
}

export async function findAllActive(): Promise<Category[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('level', { ascending: true, nullsFirst: true })
    .order('name', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Category[];
}

export async function findById(categoryId: number): Promise<Category | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('category_id', categoryId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as Category | null) ?? null;
}

export async function create(input: CreateCategoryInput): Promise<Category> {
  const supabase = await createClient();
  const payload = {
    name: input.name.trim(),
    description: input.description ?? null,
    parent_category_id: input.parent_category_id ?? null,
    level: input.level ?? null,
  };

  const { data, error } = await supabase.from('categories').insert(payload).select('*').single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Category;
}

export async function update(categoryId: number, input: UpdateCategoryInput): Promise<Category> {
  const supabase = await createClient();
  const payload: {
    name?: string;
    description?: string | null;
    parent_category_id?: number | null;
    level?: number | null;
    is_active?: boolean;
    updated_at: string;
  } = {
    updated_at: new Date().toISOString(),
  };

  if (typeof input.name === 'string') {
    payload.name = input.name.trim();
  }

  if (input.description !== undefined) {
    payload.description = input.description ?? null;
  }

  if (input.parent_category_id !== undefined) {
    payload.parent_category_id = input.parent_category_id ?? null;
  }

  if (input.level !== undefined) {
    payload.level = input.level ?? null;
  }

  if (input.is_active !== undefined) {
    payload.is_active = input.is_active;
  }

  const { data, error } = await supabase
    .from('categories')
    .update(payload)
    .eq('category_id', categoryId)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Category;
}

export async function softDelete(categoryId: number): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('categories')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('category_id', categoryId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function nameExistsUnderParent(
  name: string,
  parentCategoryId: number | null,
  excludeId?: number,
): Promise<boolean> {
  const supabase = await createClient();
  const normalizedTarget = normalizeName(name);

  let query = supabase.from('categories').select('category_id, name').limit(200);

  if (parentCategoryId === null) {
    query = query.is('parent_category_id', null);
  } else {
    query = query.eq('parent_category_id', parentCategoryId);
  }

  if (excludeId !== undefined) {
    query = query.neq('category_id', excludeId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).some((category) => normalizeName(category.name) === normalizedTarget);
}

export async function hasActiveProductReferences(categoryId: number): Promise<boolean> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from('products')
    .select('product_id', { count: 'exact', head: true })
    .eq('category_id', categoryId)
    .neq('status', 'archived');

  if (error) {
    throw new Error(error.message);
  }

  return (count ?? 0) > 0;
}

export async function getDashboardStats(): Promise<CategoryDashboardStats> {
  const supabase = await createClient();

  const [
    { count: totalCategories, error: totalCategoriesError },
    { count: activeCategories, error: activeCategoriesError },
    { count: totalProducts, error: totalProductsError },
    { count: totalSellers, error: totalSellersError },
  ] = await Promise.all([
    supabase.from('categories').select('category_id', { count: 'exact', head: true }),
    supabase
      .from('categories')
      .select('category_id', { count: 'exact', head: true })
      .eq('is_active', true),
    supabase.from('products').select('product_id', { count: 'exact', head: true }),
    supabase
      .from('users_profile')
      .select('user_id', { count: 'exact', head: true })
      .eq('role', 'seller'),
  ]);

  const firstError =
    totalCategoriesError ?? activeCategoriesError ?? totalProductsError ?? totalSellersError;

  if (firstError) {
    throw new Error(firstError.message);
  }

  return {
    totalCategories: totalCategories ?? 0,
    activeCategories: activeCategories ?? 0,
    totalProducts: totalProducts ?? 0,
    totalSellers: totalSellers ?? 0,
  };
}
