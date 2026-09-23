/**
 * What the bot asked, and what it was asking about.
 *
 * A tapped button carries at most 64 bytes, and two uuids do not fit - so the
 * transaction cannot ride in the payload. The message the buttons are attached
 * to identifies it instead, which is also what PROJECT_SPEC §3.5 requires: the
 * transaction is resolved on the server, never trusted from the client.
 */
import { and, eq, isNull } from 'drizzle-orm';

import type { UserId } from '@/core/types';
import { getDb } from '@/infrastructure/db/client';
import { notificationPrompts } from '@/infrastructure/db/schema';

export type NotificationPromptRow = typeof notificationPrompts.$inferSelect;

/** 'telegram' today. The column exists so this table survives WhatsApp. */
export type NotificationProvider = 'telegram' | 'whatsapp';

/**
 * What the message asked for.
 *
 * 'category_pick' is the one with buttons; 'category_name' is the force_reply
 * that ➕ Nueva sends. Both can be outstanding about the same spend at the same
 * time, and a reply means something different depending on which one it
 * answers - see the column's comment in schema.ts.
 */
export type NotificationPromptKind = 'category_pick' | 'category_name';

export interface RecordPromptInput {
  readonly transactionId: string;
  readonly provider: NotificationProvider;
  readonly kind: NotificationPromptKind;
  readonly chatId: bigint;
  readonly externalMessageId: bigint;
}

export async function recordPrompt(
  userId: UserId,
  input: RecordPromptInput,
): Promise<NotificationPromptRow | null> {
  const db = getDb();
  const [row] = await db
    .insert(notificationPrompts)
    .values({
      userId,
      transactionId: input.transactionId,
      provider: input.provider,
      kind: input.kind,
      chatId: input.chatId,
      externalMessageId: input.externalMessageId,
    })
    // A resend of the same message is not worth failing a request over: the
    // prompt already exists and points at the same transaction.
    .onConflictDoNothing()
    .returning();

  return row ?? null;
}

/**
 * The prompt a tapped button belongs to.
 *
 * Scoped by userId even though (provider, chat, message) is already unique:
 * the chat resolved to this user a step earlier, and a query that does not say
 * so is one refactor away from not meaning it.
 */
export async function findPromptByMessage(
  userId: UserId,
  provider: NotificationProvider,
  chatId: bigint,
  externalMessageId: bigint,
): Promise<NotificationPromptRow | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(notificationPrompts)
    .where(
      and(
        eq(notificationPrompts.userId, userId),
        eq(notificationPrompts.provider, provider),
        eq(notificationPrompts.chatId, chatId),
        eq(notificationPrompts.externalMessageId, externalMessageId),
      ),
    )
    .limit(1);

  return row ?? null;
}

/**
 * Marks a prompt answered, and says whether THIS call was the one that did it.
 *
 * The `answered_at IS NULL` in the WHERE is the idempotency: Telegram
 * redelivers a callback it did not get a 200 for, and the second delivery must
 * re-apply the category harmlessly while counting nothing twice - not an
 * achievement, not a hit, and not a second row in the level 2 gesture metric.
 *
 * A conditional UPDATE and not a SELECT-then-UPDATE: two concurrent retries
 * would both read NULL and both believe they were first (rule 6).
 */
export async function markPromptAnswered(
  userId: UserId,
  promptId: string,
): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .update(notificationPrompts)
    .set({ answeredAt: new Date() })
    .where(
      and(
        eq(notificationPrompts.userId, userId),
        eq(notificationPrompts.id, promptId),
        isNull(notificationPrompts.answeredAt),
      ),
    )
    .returning({ id: notificationPrompts.id });

  return rows.length > 0;
}
