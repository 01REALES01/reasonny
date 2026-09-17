import { z } from 'zod';

import {
  createCategory,
  type CategoryRow,
  type CategoryType,
} from '@/core/repositories/category.repository';
import type { UserId } from '@/core/types';
import { CATEGORY_COLOR_PATTERN, DEFAULT_CATEGORY_COLOR } from '@/lib/category-palette';

/**
 * Creating a category, for every client that can create one.
 *
 * It started as a Server Action, which meant it could only ever be called by a
 * React form: `requireCurrentUser()` reads cookies, and a Telegram webhook has
 * none. Rather than write the same validation a second time for the bot, the
 * rule moved here and the action became the thin wrapper it should have been
 * (P9).
 */

const CreateCategorySchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').max(50),
  type: z.enum(['expense', 'income']).default('expense'),
  icon: z.string().min(1).max(50).default('Tag'),
  // A hex, not a CSS expression. The column is varchar(20); the default that
  // used to sit here - a `var(--...)` string - was 30 characters, so it could
  // only ever have reached Postgres as an error. Validating the shape means a
  // presentation mistake is caught here instead of surfacing as a failed
  // INSERT, and a plain #rrggbb is readable by the CSV export and the Telegram
  // client, neither of which ever loads globals.css.
  color: z
    .string()
    .regex(CATEGORY_COLOR_PATTERN, 'El color no tiene un formato válido')
    .default(DEFAULT_CATEGORY_COLOR),
});

export type CreateCategoryInput = z.input<typeof CreateCategorySchema>;

export type CreateCategoryResult =
  | { readonly ok: true; readonly category: CategoryRow }
  | { readonly ok: false; readonly reason: 'invalid'; readonly message: string }
  | { readonly ok: false; readonly reason: 'duplicate' }
  | { readonly ok: false; readonly reason: 'failed' };

export async function createUserCategory(
  userId: UserId,
  rawInput: CreateCategoryInput,
): Promise<CreateCategoryResult> {
  const parsed = CreateCategorySchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid',
      message: parsed.error.issues[0]?.message ?? 'Datos de categoría inválidos',
    };
  }

  try {
    const category = await createCategory(userId, {
      name: parsed.data.name.trim(),
      type: parsed.data.type as CategoryType,
      icon: parsed.data.icon,
      color: parsed.data.color,
    });
    return { ok: true, category };
  } catch (error) {
    // The message from a driver is a SQL statement with the user's parameters
    // in it. Handing that to whoever tapped "Crear" tells them nothing they
    // can act on and puts the shape of the table on screen; the server log is
    // where it belongs.
    console.error('[category] create failed', error);

    const isDuplicate =
      error instanceof Error && /uq_categories|duplicate key/i.test(error.message);

    return isDuplicate ? { ok: false, reason: 'duplicate' } : { ok: false, reason: 'failed' };
  }
}
