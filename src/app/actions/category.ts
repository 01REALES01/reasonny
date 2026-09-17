'use server';

import { revalidatePath } from 'next/cache';

import type { CategoryRow } from '@/core/repositories/category.repository';
import {
  createUserCategory,
  type CreateCategoryInput,
} from '@/core/services/category.service';
import { toUserId } from '@/core/types';
import { requireCurrentUser } from '@/lib/session';

export type CreateCategoryActionInput = CreateCategoryInput;

export interface CategoryActionResult {
  readonly success: boolean;
  readonly category?: CategoryRow;
  readonly error?: string;
}

/**
 * The PWA's way of asking for a category.
 *
 * Session, cache invalidation and the words a human reads. The rule about what
 * a valid category is lives in core/services/category.service.ts, because the
 * Telegram client asks for the same thing without a cookie to its name.
 */
export async function createCategoryAction(
  rawInput: CreateCategoryActionInput,
): Promise<CategoryActionResult> {
  try {
    const session = await requireCurrentUser();
    const userId = toUserId(session.id);

    const result = await createUserCategory(userId, rawInput);

    if (!result.ok) {
      switch (result.reason) {
        case 'invalid':
          return { success: false, error: result.message };
        case 'duplicate':
          return { success: false, error: 'Ya tienes una categoría con ese nombre' };
        default:
          return { success: false, error: 'No se pudo crear la categoría. Intenta de nuevo.' };
      }
    }

    revalidatePath('/nuevo');
    revalidatePath('/mes');

    return { success: true, category: result.category };
  } catch (error) {
    console.error('createCategoryAction failed', error);
    return { success: false, error: 'No se pudo crear la categoría. Intenta de nuevo.' };
  }
}
