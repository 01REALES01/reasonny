'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { parseMoney } from '@/core/money';
import {
  createAccount,
  listAccounts,
} from '@/core/repositories/account.repository';
import { ensureProfile } from '@/core/repositories/profile.repository';
import { createTransaction } from '@/core/repositories/transaction.repository';
import { toAccountId, toCategoryId, toUserId } from '@/core/types';
import { requireCurrentUser } from '@/lib/session';

// Not exported: a 'use server' module may only export async functions, and
// nothing outside this file reads the schema. z.uuid() rather than the
// deprecated z.string().uuid().
const QuickAddSchema = z.object({
  amount: z.string().min(1, 'Amount is required'),
  merchant: z.string().min(1, 'Merchant is required').max(255),
  type: z.enum(['expense', 'income']).default('expense'),
  categoryId: z.uuid().optional().nullable(),
  accountId: z.uuid().optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
  transactionDate: z.string().optional(),
});

export type QuickAddInput = z.infer<typeof QuickAddSchema>;

export interface ActionResult {
  readonly success: boolean;
  readonly transactionId?: string;
  readonly error?: string;
}

/**
 * Server Action for rapid manual transaction entry.
 *
 * Validates input on the server, resolves default account/currency if missing,
 * and records the transaction under the authenticated user's isolated partition.
 */
export async function createQuickTransactionAction(
  rawInput: QuickAddInput,
): Promise<ActionResult> {
  try {
    const session = await requireCurrentUser();
    const userId = toUserId(session.id);

    const parsed = QuickAddSchema.safeParse(rawInput);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return { success: false, error: issue ? issue.message : 'Invalid transaction data.' };
    }

    const { amount, merchant, type, categoryId, accountId, note, transactionDate } = parsed.data;

    // Ensure user profile exists and resolve base currency
    const profile = await ensureProfile(userId, session.email);
    const baseCurrency = profile?.baseCurrency ?? 'COP';

    // Parse amount to minor units
    let amountMinor: bigint;
    try {
      const parsedMoney = parseMoney(amount, baseCurrency);
      if (parsedMoney.minor <= 0n) {
        return { success: false, error: 'Amount must be greater than 0.' };
      }
      amountMinor = parsedMoney.minor;
    } catch (parseError) {
      return {
        success: false,
        error: parseError instanceof Error ? parseError.message : 'Invalid amount format.',
      };
    }

    // Resolve account if not specified
    let targetAccountId = accountId ? toAccountId(accountId) : null;
    let currency = baseCurrency;

    if (!targetAccountId) {
      const accounts = await listAccounts(userId);
      if (accounts.length > 0 && accounts[0]) {
        targetAccountId = toAccountId(accounts[0].id);
        currency = accounts[0].currency;
      } else {
        // Create initial default account if none exists
        const defaultAccount = await createAccount(userId, {
          name: 'Efectivo',
          type: 'cash',
          currency: baseCurrency,
        });
        targetAccountId = toAccountId(defaultAccount.id);
      }
    }

    const txDate = transactionDate ? new Date(transactionDate) : new Date();

    const { transaction } = await createTransaction(userId, {
      accountId: targetAccountId,
      categoryId: categoryId ? toCategoryId(categoryId) : null,
      amountMinor,
      currency,
      type,
      merchant: merchant.trim(),
      merchantNormalized: merchant.trim().toLowerCase(),
      note: note?.trim() || null,
      transactionDate: txDate,
      source: 'manual',
      categorizedBy: categoryId ? 'manual' : null,
    });

    revalidatePath('/');
    revalidatePath('/nuevo');

    return {
      success: true,
      transactionId: transaction.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to record transaction.',
    };
  }
}
