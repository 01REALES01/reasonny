'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { MAX_USABLE_ACCURACY_M } from '@/core/geo';
import { parseMoney } from '@/core/money';
import {
  createAccount,
  getAccount,
  listAccounts,
} from '@/core/repositories/account.repository';
import { getCategory } from '@/core/repositories/category.repository';
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
  // Optional and bounded: it comes from navigator.geolocation in the browser,
  // which is a trust boundary. Absent is the normal case - the user may have
  // the feature off, denied the permission, or be indoors with no fix.
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  locationAccuracyM: z.number().min(0).max(100_000).optional().nullable(),
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

    const {
      amount,
      merchant,
      type,
      categoryId,
      accountId,
      note,
      transactionDate,
      latitude,
      longitude,
      locationAccuracyM,
    } = parsed.data;

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

    // Resolve account if not specified.
    //
    // A caller-supplied accountId is verified to belong to this user before it
    // is written. It arrives from a <select> in the browser, and a branded type
    // only proves it is a well-formed uuid - it says nothing about ownership.
    // transactions.account_id is a foreign key to accounts.id alone, not a
    // composite with user_id, so the database would happily store a row of
    // ours against someone else's account.
    let targetAccountId = null;
    let currency = baseCurrency;

    if (accountId) {
      const account = await getAccount(userId, toAccountId(accountId));
      if (!account) {
        return { success: false, error: 'Unknown account.' };
      }
      targetAccountId = toAccountId(account.id);
      currency = account.currency;
    }

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

    // Same check as the account above, same reason: the category id comes from
    // a list rendered in the browser, and the foreign key does not carry the
    // owner. Tagging our row with someone else's category would surface their
    // category name back to us through the dashboard's join.
    let targetCategoryId = null;
    if (categoryId) {
      const category = await getCategory(userId, toCategoryId(categoryId));
      if (!category) {
        return { success: false, error: 'Unknown category.' };
      }
      targetCategoryId = toCategoryId(category.id);
    }

    const txDate = transactionDate ? new Date(transactionDate) : new Date();

    // Three conditions, all of them on the server. The browser can send a
    // coordinate whenever it likes; whether one is stored is decided here,
    // against the profile - a client that stops asking politely must not be
    // able to start a location history on its own.
    const location =
      profile.locationEnabled &&
      latitude !== null &&
      latitude !== undefined &&
      longitude !== null &&
      longitude !== undefined &&
      (locationAccuracyM === null ||
        locationAccuracyM === undefined ||
        locationAccuracyM <= MAX_USABLE_ACCURACY_M)
        ? {
            latitude,
            longitude,
            accuracyM: locationAccuracyM ?? null,
            // Not 'shortcut': this is where the spend was WRITTEN DOWN, which
            // is only the same place as where it was paid when the user
            // records it on the spot.
            source: 'device_pwa' as const,
          }
        : null;

    const { transaction } = await createTransaction(userId, {
      accountId: targetAccountId,
      categoryId: targetCategoryId,
      amountMinor,
      currency,
      type,
      merchant: merchant.trim(),
      note: note?.trim() || null,
      transactionDate: txDate,
      source: 'manual',
      categorizedBy: targetCategoryId ? 'manual' : null,
      location,
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
