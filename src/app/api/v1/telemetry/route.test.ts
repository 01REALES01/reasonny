import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/core/services/telemetry.service', () => ({
  recordMetrics: vi.fn(),
}));

import { NextRequest } from 'next/server';

import { recordMetrics } from '@/core/services/telemetry.service';
import { toUserId } from '@/core/types';
import { getCurrentUser } from '@/lib/session';

import { POST } from './route';

describe('POST /api/v1/telemetry Route Handler', () => {
  const userId = toUserId('11111111-1111-4111-8111-111111111111');

  function beaconWith(body: unknown): NextRequest {
    return new NextRequest('http://localhost:3000/api/v1/telemetry', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    (recordMetrics as any).mockResolvedValue({ recorded: 1, rejected: [] });
  });

  it('records a well-formed beacon from a signed-in user', async () => {
    (getCurrentUser as any).mockResolvedValue({ id: userId, email: 'jean@example.com' });

    const res = await POST(
      beaconWith({
        samples: [
          { metric: 'LCP', value: 2431.7, rating: 'good', route: '/' },
          { metric: 'CLS', value: 0.083, rating: 'good', route: '/' },
        ],
      }),
    );

    expect(res.status).toBe(204);
    expect(recordMetrics).toHaveBeenCalledWith(userId, [
      { metric: 'LCP', value: 2431.7, rating: 'good', route: '/' },
      { metric: 'CLS', value: 0.083, rating: 'good', route: '/' },
    ]);
  });

  it('writes nothing for an anonymous beacon', async () => {
    // Telemetry rows are per-tenant by construction; there is no user to
    // attribute an anonymous sample to.
    (getCurrentUser as any).mockResolvedValue(null);

    const res = await POST(beaconWith({ samples: [{ metric: 'LCP', value: 1000 }] }));

    expect(res.status).toBe(204);
    expect(recordMetrics).not.toHaveBeenCalled();
  });

  it('attributes samples to the session user and ignores any id in the body', async () => {
    // The body is browser-supplied. If a userId in it were ever honoured, one
    // account could write telemetry into another's partition.
    (getCurrentUser as any).mockResolvedValue({ id: userId, email: 'jean@example.com' });

    await POST(
      beaconWith({
        userId: '22222222-2222-4222-8222-222222222222',
        samples: [{ metric: 'INP', value: 120 }],
      }),
    );

    expect(recordMetrics).toHaveBeenCalledWith(userId, [
      { metric: 'INP', value: 120, rating: null, route: null },
    ]);
  });

  it('rejects a metric name the database CHECK would refuse', async () => {
    (getCurrentUser as any).mockResolvedValue({ id: userId, email: 'jean@example.com' });

    // FID was replaced by INP and is not in the CHECK constraint. Catching it
    // here turns a constraint violation inside a fire-and-forget write into a
    // logged rejection.
    const res = await POST(beaconWith({ samples: [{ metric: 'FID', value: 100 }] }));

    expect(res.status).toBe(204);
    expect(recordMetrics).not.toHaveBeenCalled();
  });

  it('rejects a negative value', async () => {
    (getCurrentUser as any).mockResolvedValue({ id: userId, email: 'jean@example.com' });

    const res = await POST(beaconWith({ samples: [{ metric: 'LCP', value: -1 }] }));

    expect(res.status).toBe(204);
    expect(recordMetrics).not.toHaveBeenCalled();
  });

  it('rejects an absurd value that would drag every future percentile', async () => {
    (getCurrentUser as any).mockResolvedValue({ id: userId, email: 'jean@example.com' });

    const res = await POST(
      beaconWith({ samples: [{ metric: 'LCP', value: 999_999_999 }] }),
    );

    expect(res.status).toBe(204);
    expect(recordMetrics).not.toHaveBeenCalled();
  });

  it('rejects a batch larger than the per-request bound', async () => {
    (getCurrentUser as any).mockResolvedValue({ id: userId, email: 'jean@example.com' });

    const samples = Array.from({ length: 11 }, () => ({ metric: 'LCP', value: 1000 }));
    const res = await POST(beaconWith({ samples }));

    expect(res.status).toBe(204);
    expect(recordMetrics).not.toHaveBeenCalled();
  });

  it('rejects an empty batch', async () => {
    (getCurrentUser as any).mockResolvedValue({ id: userId, email: 'jean@example.com' });

    const res = await POST(beaconWith({ samples: [] }));

    expect(res.status).toBe(204);
    expect(recordMetrics).not.toHaveBeenCalled();
  });

  it('survives a body that is not JSON', async () => {
    (getCurrentUser as any).mockResolvedValue({ id: userId, email: 'jean@example.com' });

    const res = await POST(beaconWith('not json at all'));

    expect(res.status).toBe(204);
    expect(recordMetrics).not.toHaveBeenCalled();
  });

  it('answers 204 even when the write throws', async () => {
    // sendBeacon discards the response. Surfacing a 500 here would achieve
    // nothing except turning a lost measurement into a visible error.
    (getCurrentUser as any).mockResolvedValue({ id: userId, email: 'jean@example.com' });
    (recordMetrics as any).mockRejectedValue(new Error('neon is asleep'));

    const res = await POST(beaconWith({ samples: [{ metric: 'LCP', value: 1000 }] }));

    expect(res.status).toBe(204);
    expect(console.error).toHaveBeenCalled();
  });
});
