'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { parseMoney } from '@/core/money';
import { ensureProfile } from '@/core/repositories/profile.repository';
import { recordTransaction } from '@/core/services/transaction.service';
import { toUserId } from '@/core/types';
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
 * Validates the form on the server, then hands the sentence to
 * core/services/transaction.service.ts - the same function the Shortcut
 * endpoint and the Telegram bot call. What "record a spend" MEANS is not
 * decided here (P9).
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

    const result = await recordTransaction(userId, profile, {
      amountMinor,
      type,
      merchant,
      note,
      transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
      source: 'manual',
      accountId,
      categoryId,
      location: { latitude, longitude, accuracyM: locationAccuracyM },
      // Not 'shortcut': this is where the spend was WRITTEN DOWN, which is only
      // the same place as where it was paid when the user records it on the
      // spot.
      locationSource: 'device_pwa',
    });

    if (!result.ok) {
      return {
        success: false,
        error: result.reason === 'unknown_account' ? 'Unknown account.' : 'Unknown category.',
      };
    }

    revalidatePath('/');
    revalidatePath('/nuevo');

    return {
      success: true,
      transactionId: result.transaction.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to record transaction.',
    };
  }
}
