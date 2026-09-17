'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { createCategory } from '@/core/repositories/category.repository';
import type { CategoryRow } from '@/core/repositories/category.repository';
import { toUserId } from '@/core/types';
import {
  CATEGORY_COLOR_PATTERN,
  DEFAULT_CATEGORY_COLOR,
} from '@/lib/category-palette';
import { requireCurrentUser } from '@/lib/session';

const CreateCategorySchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').max(50),
  type: z.enum(['expense', 'income']).default('expense'),
  icon: z.string().min(1).max(50).default('Tag'),
  // A hex, not a CSS expression. The column is varchar(20); the previous
  // default here - a `var(--...)` string - was 30 characters, so it could only
  // ever have reached Postgres as an error. Validating the shape means a
  // presentation mistake is caught in the action instead of surfacing to the
  // user as a failed INSERT.
  color: z
    .string()
    .regex(CATEGORY_COLOR_PATTERN, 'El color no tiene un formato válido')
    .default(DEFAULT_CATEGORY_COLOR),
});

export type CreateCategoryActionInput = z.infer<typeof CreateCategorySchema>;

export interface CategoryActionResult {
  readonly success: boolean;
  readonly category?: CategoryRow;
  readonly error?: string;
}

export async function createCategoryAction(
  rawInput: CreateCategoryActionInput,
): Promise<CategoryActionResult> {
  try {
    const session = await requireCurrentUser();
    const userId = toUserId(session.id);

    const parsed = CreateCategorySchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Datos de categoría inválidos',
      };
    }

    const category = await createCategory(userId, {
      name: parsed.data.name.trim(),
      type: parsed.data.type,
      icon: parsed.data.icon,
      color: parsed.data.color,
    });

    revalidatePath('/nuevo');
    revalidatePath('/mes');

    return {
      success: true,
      category,
    };
  } catch (error) {
    // The message from a driver is a SQL statement with the user's parameters
    // in it. Showing that to whoever tapped "Crear" tells them nothing they can
    // act on and puts the shape of the table on screen; the server log is where
    // it belongs.
    console.error('createCategoryAction failed', error);

    const isDuplicate =
      error instanceof Error && /uq_categories|duplicate key/i.test(error.message);

    return {
      success: false,
      error: isDuplicate
        ? 'Ya tienes una categoría con ese nombre'
        : 'No se pudo crear la categoría. Intenta de nuevo.',
    };
  }
}
