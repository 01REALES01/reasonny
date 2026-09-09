import { createHash } from 'node:crypto';

import { revalidatePath } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  createAccount,
  listAccounts,
} from '@/core/repositories/account.repository';
import { recordIngestionFailure } from '@/core/repositories/ingestion-failure.repository';
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

const SOURCE = 'sms_shortcut';

/**
 * Every outcome leaves a trace, and the ones that store nothing leave two.
 *
 * WHY THIS EXISTS
 * ---------------
 * A transfer was made, the SMS arrived, the Shortcut fired, and the app had
 * nothing to show and nothing to say about why. Every non-2xx and every
 * `stored: false` was returned to a caller that discards the body - Shortcuts
 * does not surface a response - so the reason existed for the length of one
 * HTTP response and then did not exist at all.
 *
 * The row carries the raw message, which is what makes it worth having: it is
 * the only artefact that can tell you which template a bank changed. The
 * console line deliberately does NOT carry it - platform logs are the least
 * controlled place this data could sit, and the reason alone is enough to see
 * the shape of a problem from the outside.
 */
async function refuse(
  userId: UserId | null,
  status: number,
  body: Record<string, unknown>,
  rawPayload: unknown,
  error: string,
): Promise<NextResponse> {
  console.warn('[quick-add] not stored:', error, 'status:', status);
  try {
    await recordIngestionFailure(userId, { source: SOURCE, rawPayload, error });
  } catch (cause) {
    // A failure to record a failure must not turn into a 500 the Shortcut
    // will retry forever. The console line above already happened.
    console.error('[quick-add] could not record the failure:', cause);
  }
  return NextResponse.json(body, { status });
}

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
    // No user to attribute it to, and that is precisely why it is recorded: a
    // token that does not verify is the failure hardest to diagnose from the
    // phone, because the Shortcut shows the same nothing either way.
    return refuse(null, 401, { error: 'unauthorized' }, { authorization: 'invalid' }, 'unauthorized');
  }

  const rawText = await request.text();

  let body: unknown;
  try {
    body = JSON.parse(rawText);
  } catch {
    return refuse(userId, 400, { error: 'invalid_json' }, { raw: rawText }, 'invalid_json');
  }

  const parsedBody = BodySchema.safeParse(body);
  if (!parsedBody.success) {
    // The commonest real cause: the Shortcut's JSON field is named something
    // other than `text`, or its value was left empty.
    return refuse(userId, 400, { error: 'invalid_body' }, body, 'invalid_body');
  }

  const { text } = parsedBody.data;
  const result = parseBankSms(text);

  if (!result.ok) {
    // 200, not an error status. A declined purchase and an unreadable format
    // are both things the endpoint handled correctly, and the Shortcut must not
    // retry either of them - a non-2xx would make Apple send the same message
    // again and again. It is still a failure worth keeping: 'unknown_bank' on
    // a real message is a bank nobody has written a parser for yet, and
    // 'unrecognized_format' is a template that changed under one that exists.
    return refuse(
      userId,
      200,
      { stored: false, reason: result.reason, bank: result.bank },
      { text, bank: result.bank },
      result.reason,
    );
  }

  const tx = result.transaction;

  // getProfile, not ensureProfile: the token proves who the caller is but the
  // row is created when they first sign in, and ensureProfile would need an
  // email this request does not have - it would write an empty one.
  const profile = await getProfile(userId);
  if (!profile) {
    return refuse(userId, 404, { error: 'profile_not_found' }, { text }, 'profile_not_found');
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
    source: SOURCE,
    idempotencyKey: parsedBody.data.idempotencyKey ?? idempotencyKeyFor(userId, text),
    categorizedBy: null,
  });

  console.info(
    '[quick-add] stored:', !isDuplicate,
    'duplicate:', isDuplicate,
    'bank:', tx.bank,
    'type:', tx.type,
  );

  revalidatePath('/dashboard');
  revalidatePath('/revisar');
  revalidatePath('/captura');
  revalidatePath('/perfil');

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
