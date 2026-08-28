import { createHash } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';

import { verifyAndTouchApiKey } from '@/core/repositories/api-key.repository';
import { getRecentEnrichedTransactions } from '@/core/repositories/transaction.repository';
import {
  formatTransactionToCsvRow,
  getCsvHeaderLine,
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

/**
 * Streams the user's financial transactions as an RFC 4180 CSV export.
 *
 * WHY STREAMING (CLAUDE.md / IMPLEMENTATION_PLAN.md B7)
 * ----------------------------------------------------
 * Buffering thousands of transaction strings in memory risks Node serverless OOM
 * and inflates TTFB. Streaming writes lines directly to the wire in constant O(1) memory.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const userId = await authenticateRequest(request);

  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized. Please sign in or provide a valid Bearer API key.' },
      { status: 401 },
    );
  }

  // Fetch all active transactions for this user
  const transactions = await getRecentEnrichedTransactions(userId, 50000);

  const todayIso = new Date().toISOString().split('T')[0];
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(getCsvHeaderLine()));

      for (const tx of transactions) {
        const line = `${formatTransactionToCsvRow(tx)}\r\n`;
        controller.enqueue(encoder.encode(line));
      }

      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="realmoney-export-${todayIso}.csv"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
