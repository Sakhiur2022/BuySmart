'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  createCategory,
  softDeleteCategory,
  updateCategory,
} from '@/lib/controllers/category.controller';
import { createClient } from '@/lib/supabase/server';

const CreateCategorySchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional().nullable(),
  parent_category_id: z.number().int().positive().optional().nullable(),
});

const UpdateCategorySchema = CreateCategorySchema.partial().extend({
  is_active: z.boolean().optional(),
});

type CategoryActionResult<T> = { success: true; data: T } | { success: false; error: string };

async function requireAdmin(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('Unauthorized');
  }

  const { data: profile, error: profileError } = await supabase
    .from('users_profile')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError || profile?.role !== 'admin') {
    throw new Error('Unauthorized');
  }
}

function normalizeTextField(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function revalidateCategoryPaths(): void {
  revalidatePath('/admin/categories');
  revalidatePath('/seller/products/new');
  revalidatePath('/seller/products/[productId]/edit', 'page');
}

export async function createCategoryAction(
  input: z.input<typeof CreateCategorySchema>,
): Promise<CategoryActionResult<{ category_id: number }>> {
  try {
    await requireAdmin();

    const parsed = CreateCategorySchema.safeParse({
      ...input,
      description: normalizeTextField(input.description),
    });

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid category input';
      return { success: false, error: message };
    }

    const category = await createCategory(parsed.data);
    revalidateCategoryPaths();

    return { success: true, data: { category_id: category.category_id } };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create category';
    return { success: false, error: message };
  }
}

export async function updateCategoryAction(
  categoryId: number,
  input: z.input<typeof UpdateCategorySchema>,
): Promise<CategoryActionResult<{ category_id: number }>> {
  try {
    await requireAdmin();

    const parsed = UpdateCategorySchema.safeParse({
      ...input,
      description: normalizeTextField(input.description),
    });

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid category input';
      return { success: false, error: message };
    }

    const category = await updateCategory(categoryId, parsed.data);
    revalidateCategoryPaths();

    return { success: true, data: { category_id: category.category_id } };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update category';
    return { success: false, error: message };
  }
}

export async function softDeleteCategoryAction(
  categoryId: number,
): Promise<CategoryActionResult<null>> {
  try {
    await requireAdmin();
    await softDeleteCategory(categoryId);
    revalidateCategoryPaths();
    return { success: true, data: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to deactivate category';
    return { success: false, error: message };
  }
}
