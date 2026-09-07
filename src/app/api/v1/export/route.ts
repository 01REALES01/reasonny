import { createHash } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';

import { verifyAndTouchApiKey } from '@/core/repositories/api-key.repository';
import { getRecentEnrichedTransactions } from '@/core/repositories/transaction.repository';
import {
  CSV_HEADER_LINE,
  formatTransactionToCsvRow,
} from '@/core/services/csv-export.service';
import { toUserId, type UserId } from '@/core/types';
import { getCurrentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * Resolves the authenticated user from either cookie session or Bearer API Key.
 */
async function authenticateRequest(request: NextRequest): Promise<UserId | null> {
  // 1. Browser session check
  const session = await getCurrentUser();
  if (session?.id) {
    return toUserId(session.id);
  }

  // 2. Bearer API key check (e.g. Shortcut, script, external export)
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const rawKey = authHeader.slice(7).trim();
    if (rawKey) {
      const keyHash = createHash('sha256').update(rawKey).digest('hex');
      const apiKeyRecord = await verifyAndTouchApiKey(keyHash);
      if (apiKeyRecord?.userId) {
        return apiKeyRecord.userId;
      }
    }
  }

  return null;
}

const EXPORT_ROW_LIMIT = 50_000;

/**
 * Serves the user's financial transactions as an RFC 4180 CSV export.
 *
 * WHY THIS IS NOT A ReadableStream
 * --------------------------------
 * It used to be one, under a comment promising "constant O(1) memory". It was
 * not: the line above it loads every row into an array first, and the stream's
 * start() then enqueued all of them synchronously before returning - the whole
 * dataset in memory, plus a second copy sitting in the stream's queue. The
 * ceremony bought nothing and hid the actual bound, which is EXPORT_ROW_LIMIT.
 *
 * Real streaming means a cursor in the repository handing rows out in batches,
 * which is a change to the data layer, not to this handler. Until an export is
 * big enough to need it, the honest version is the short one.
 *
 * ponytail: whole result set in memory, bounded by EXPORT_ROW_LIMIT. Move to a
 * cursor in transaction.repository if a real export ever approaches it.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const userId = await authenticateRequest(request);

  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized. Please sign in or provide a valid Bearer API key.' },
      { status: 401 },
    );
  }

  const transactions = await getRecentEnrichedTransactions(userId, EXPORT_ROW_LIMIT);
  const todayIso = new Date().toISOString().split('T')[0];

  // Accumulated rather than map().join(''): at the row limit the map would hold
  // a 50 000-element array of line strings alongside the rows themselves and
  // the finished body. Same output, one fewer full copy of the dataset.
  let body = CSV_HEADER_LINE;
  for (const tx of transactions) {
    body += `${formatTransactionToCsvRow(tx)}\r\n`;
  }

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="reasonny-export-${todayIso}.csv"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
