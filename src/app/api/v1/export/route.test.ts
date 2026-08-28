import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/core/repositories/api-key.repository', () => ({
  verifyAndTouchApiKey: vi.fn(),
}));

vi.mock('@/core/repositories/transaction.repository', () => ({
  getRecentEnrichedTransactions: vi.fn(),
}));

import { NextRequest } from 'next/server';

import { verifyAndTouchApiKey } from '@/core/repositories/api-key.repository';
import { getRecentEnrichedTransactions } from '@/core/repositories/transaction.repository';
import { toApiKeyId, toUserId } from '@/core/types';
import { getCurrentUser } from '@/lib/session';

import { GET } from './route';

describe('GET /api/v1/export Route Handler', () => {
  const userId = toUserId('11111111-1111-4111-8111-111111111111');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no session or Bearer key is provided', async () => {
    (getCurrentUser as any).mockResolvedValue(null);
    const req = new NextRequest('http://localhost:3000/api/v1/export');

    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('streams CSV successfully when authenticated via session', async () => {
    (getCurrentUser as any).mockResolvedValue({ id: userId, email: 'jean@example.com' });
    (getRecentEnrichedTransactions as any).mockResolvedValue([
      {
        id: 'tx-1',
        amountMinor: 4500000n,
        currency: 'COP',
        type: 'expense',
        status: 'confirmed',
        merchant: 'Juan Valdez',
        note: null,
        transactionDate: new Date('2026-08-27T10:00:00Z'),
        categorizedBy: 'manual',
        category: { id: 'cat-1', name: 'Café', icon: 'Coffee', color: '#F59E0B' },
        account: { id: 'acc-1', name: 'Principal', currency: 'COP' },
      },
    ]);

    const req = new NextRequest('http://localhost:3000/api/v1/export');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(res.headers.get('content-disposition')).toContain('attachment');

    const csvText = await res.text();
    expect(csvText).toContain('id,date,merchant,amount');
    expect(csvText).toContain('Juan Valdez');
    expect(csvText).toContain('45000.00');
  });

  it('streams CSV successfully when authenticated via Bearer API key', async () => {
    (getCurrentUser as any).mockResolvedValue(null);
    (verifyAndTouchApiKey as any).mockResolvedValue({
      userId,
      keyId: toApiKeyId('55555555-5555-4555-8555-555555555555'),
    });
    (getRecentEnrichedTransactions as any).mockResolvedValue([]);

    const req = new NextRequest('http://localhost:3000/api/v1/export', {
      headers: { authorization: 'Bearer rm_live_testkey123456789' },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(verifyAndTouchApiKey).toHaveBeenCalled();
  });
});
