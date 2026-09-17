'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { parseMoney } from '@/core/money';
import { getCategory } from '@/core/repositories/category.repository';
import { ensureProfile } from '@/core/repositories/profile.repository';
import {
  softDeleteTransaction,
  updateTransaction,
} from '@/core/repositories/transaction.repository';
import {
  categorizeTransaction,
  learnFromTransaction,
} from '@/core/services/categorization.service';
import { toCategoryId, toUserId } from '@/core/types';
import { requireCurrentUser } from '@/lib/session';

// Not exported: a 'use server' module may only export async functions.
const EditSchema = z.object({
  transactionId: z.uuid(),
  merchant: z.string().trim().min(1, 'El comercio es obligatorio.').max(255),
  amount: z.string().min(1, 'El monto es obligatorio.'),
  categoryId: z.uuid().nullable(),
  note: z.string().max(1000).nullable(),
});

export type EditTransactionInput = z.infer<typeof EditSchema>;

export interface EditActionResult {
  readonly success: boolean;
  readonly error?: string;
}

/**
 * Applies an edit to a transaction the user already recorded.
 *
 * Until now a spend saved with the wrong category or a typo in the merchant
 * stayed wrong forever, and every wrong category quietly skewed the breakdown
 * on the dashboard.
 */
export async function editTransactionAction(
  input: EditTransactionInput,
): Promise<EditActionResult> {
  const session = await requireCurrentUser();
  const userId = toUserId(session.id);

  const parsed = EditSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Datos inválidos.',
    };
  }

  const { transactionId, merchant, amount, categoryId, note } = parsed.data;

  const profile = await ensureProfile(userId, session.email);

  // parseMoney, never Number(): the whole point of core/money is that no amount
  // is ever reconstructed by hand from a string.
  let amountMinor: bigint;
  try {
    const parsedMoney = parseMoney(amount, profile.baseCurrency);
    if (parsedMoney.minor <= 0n) {
      return { success: false, error: 'El monto debe ser mayor a 0.' };
    }
    amountMinor = parsedMoney.minor;
  } catch (parseError) {
    return {
      success: false,
      error:
        parseError instanceof Error ? parseError.message : 'El monto no es válido.',
    };
  }

  // The category has to be verified against this user before it is written.
  // Accepting the id from the form as-is would let one tenant file a spend
  // under another tenant's category, which the isolation test exists to catch.
  if (categoryId) {
    const category = await getCategory(userId, toCategoryId(categoryId));
    if (!category) {
      return { success: false, error: 'Esa categoría no existe.' };
    }
  }

  const updated = await updateTransaction(userId, transactionId, {
    merchant,
    amountMinor,
    categoryId: categoryId ? toCategoryId(categoryId) : null,
    note: note || null,
  });

  if (!updated) {
    return { success: false, error: 'No se encontró la transacción.' };
  }

  // Correcting a category here is the same statement as tapping one in the
  // review queue, so it teaches the engine the same way. From the returned row,
  // not from the input: an edit may rename the shop and recategorise it in one
  // go, and the rule belongs under the name the row ended up with.
  await learnFromTransaction(userId, updated);

  revalidatePath('/dashboard');
  revalidatePath('/revisar');

  return { success: true };
}

/**
 * Assigns a category from the review queue.
 *
 * Separate from the full edit because the queue is a one-tap screen: sending a
 * whole transaction payload back just to set one field would make a misplaced
 * default silently overwrite the merchant or the amount.
 */
export async function categorizeTransactionAction(
  transactionId: string,
  categoryId: string,
): Promise<EditActionResult> {
  const session = await requireCurrentUser();
  const userId = toUserId(session.id);

  const parsed = z
    .object({ transactionId: z.uuid(), categoryId: z.uuid() })
    .safeParse({ transactionId, categoryId });

  if (!parsed.success) {
    return { success: false, error: 'Datos inválidos.' };
  }

  // The engine learns here. Tapping a category in the queue is the clearest
  // statement a user ever makes about a merchant, and it is what stops the
  // queue asking about that shop again.
  const result = await categorizeTransaction(
    userId,
    parsed.data.transactionId,
    parsed.data.categoryId,
  );

  if (!result.ok) {
    return {
      success: false,
      error:
        result.reason === 'unknown_category'
          ? 'Esa categoría no existe.'
          : 'No se encontró la transacción.',
    };
  }

  revalidatePath('/dashboard');
  revalidatePath('/revisar');

  return { success: true };
}

/**
 * Soft-deletes a transaction. The row stays; `deleted_at` is set.
 */
export async function deleteTransactionAction(
  transactionId: string,
): Promise<EditActionResult> {
  const session = await requireCurrentUser();

  const parsed = z.uuid().safeParse(transactionId);
  if (!parsed.success) {
    return { success: false, error: 'Datos inválidos.' };
  }

  const deleted = await softDeleteTransaction(toUserId(session.id), parsed.data);
  if (!deleted) {
    return { success: false, error: 'No se encontró la transacción.' };
  }

  revalidatePath('/dashboard');
  revalidatePath('/revisar');

  return { success: true };
}
