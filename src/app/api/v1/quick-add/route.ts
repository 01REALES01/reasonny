import { createHash } from 'node:crypto';

import { revalidatePath } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  createAccount,
  listAccounts,
} from '@/core/repositories/account.repository';
import { getProfile } from '@/core/repositories/profile.repository';
import { createTransaction } from '@/core/repositories/transaction.repository';
import { toAccountId, type UserId } from '@/core/types';
import { parseBankSms } from '@/infrastructure/sms-parsers';
import { readBearer, verifyIngestToken } from '@/lib/ingest-token';

/**
 * Ingestion endpoint.
 *
 * A Route Handler and not a Server Action, because a third party calls it: the
 * iOS Shortcut fired by the SMS automation. It takes the raw message, parses
 * it, and writes the transaction.
 *
 * The Node runtime is required - neon-serverless opens a WebSocket, which the
 * Edge runtime cannot do.
 */
export const runtime = 'nodejs';

const BodySchema = z.object({
  /** The SMS, exactly as it arrived. Parsing happens here, not in the Shortcut. */
  text: z.string().min(1).max(2000),
  /**
   * Optional client-generated id. When the Shortcut cannot produce one - and
   * Shortcuts has no stable per-run uuid - the message itself is the key.
   */
  idempotencyKey: z.uuid().optional(),
});

/**
 * A deterministic uuid from the message.
 *
 * Apple's Wallet and SMS automations are documented to time out and retry, so
 * the same message can arrive twice. Deriving the key from the text means the
 * second delivery collides with the first on the partial unique index and is
 * dropped by ON CONFLICT DO NOTHING - a constraint, never a SELECT-then-INSERT,
 * which is a TOCTOU that lets two concurrent retries both insert.
 *
 * The user id is in the hash so the same message text from two users cannot
 * collide, and the shape is a v4-looking uuid because the column is `uuid`.
 */
function idempotencyKeyFor(userId: string, text: string): string {
  const hex = createHash('sha256')
    .update(`${userId}:${text.trim()}`)
    .digest('hex');

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    ((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join('-');
}

async function resolveAccount(
  userId: UserId,
  baseCurrency: string,
): Promise<{ accountId: ReturnType<typeof toAccountId> }> {
  const accounts = await listAccounts(userId);
  const first = accounts[0];
  if (first) {
    return { accountId: toAccountId(first.id) };
  }

  const created = await createAccount(userId, {
    name: 'Efectivo',
    type: 'cash',
    currency: baseCurrency,
  });
  return { accountId: toAccountId(created.id) };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let userId: UserId | null;
  try {
    userId = verifyIngestToken(readBearer(request.headers.get('authorization')));
  } catch {
    // The secret is missing on the server. That is our fault, not the caller's.
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 });
  }

  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsedBody = BodySchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { text } = parsedBody.data;
  const result = parseBankSms(text);

  if (!result.ok) {
    // 200, not an error status. A declined purchase and an unreadable format
    // are both things the endpoint handled correctly, and the Shortcut must not
    // retry either of them - a non-2xx would make Apple send the same message
    // again and again.
    return NextResponse.json(
      { stored: false, reason: result.reason, bank: result.bank },
      { status: 200 },
    );
  }

  const tx = result.transaction;

  // getProfile, not ensureProfile: the token proves who the caller is but the
  // row is created when they first sign in, and ensureProfile would need an
  // email this request does not have - it would write an empty one.
  const profile = await getProfile(userId);
  if (!profile) {
    return NextResponse.json({ error: 'profile_not_found' }, { status: 404 });
  }

  const { accountId } = await resolveAccount(userId, profile.baseCurrency);

  const { transaction, isDuplicate } = await createTransaction(userId, {
    accountId,
    // No category. The rule engine does not exist yet, and guessing one would
    // put a wrong colour in the breakdown that nobody would think to correct.
    // Uncategorised is exactly what /revisar is for.
    categoryId: null,
    amountMinor: tx.amountMinor,
    // The parser's currency, not the account's: the amount was read from a
    // message written in that currency, and relabelling it would change what
    // the number means.
    currency: tx.currency,
    type: tx.type,
    merchant: tx.merchant,
    merchantNormalized: tx.merchant.toLowerCase(),
    transactionDate: tx.transactionDate,
    source: 'sms_shortcut',
    idempotencyKey: parsedBody.data.idempotencyKey ?? idempotencyKeyFor(userId, text),
    categorizedBy: null,
  });

  revalidatePath('/dashboard');
  revalidatePath('/revisar');

  return NextResponse.json(
    {
      stored: !isDuplicate,
      duplicate: isDuplicate,
      id: transaction.id,
      merchant: tx.merchant,
      type: tx.type,
      bank: tx.bank,
    },
    { status: isDuplicate ? 200 : 201 },
  );
}
