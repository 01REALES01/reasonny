import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/repositories/consent.repository', () => ({
  hasConsent: vi.fn(),
  recordConsent: vi.fn(),
}));
vi.mock('@/core/repositories/auth-identity.repository', () => ({
  deleteAuthIdentity: vi.fn(),
}));
vi.mock('@/core/repositories/profile.repository', () => ({
  ensureProfile: vi.fn(),
  deleteProfile: vi.fn(),
}));

import { POLICY_VERSION } from '@/core/privacy';
import { hasConsent, recordConsent } from '@/core/repositories/consent.repository';
import { deleteProfile, ensureProfile } from '@/core/repositories/profile.repository';
import { toUserId } from '@/core/types';

import { acceptPolicy, deleteAccountData, resolveConsent } from './privacy.service';

const userId = toUserId('0192d5a0-0000-7000-8000-000000000001');

describe('privacy.service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('allows a user with a consent on record and writes nothing', async () => {
    vi.mocked(hasConsent).mockResolvedValue(true);

    expect(await resolveConsent(userId, 'a@example.com', undefined)).toBe('allow');
    expect(recordConsent).not.toHaveBeenCalled();
  });

  it('turns the box ticked at sign-in into a consent, profile first', async () => {
    vi.mocked(hasConsent).mockResolvedValue(false);
    const order: string[] = [];
    vi.mocked(ensureProfile).mockImplementation(async () => {
      order.push('profile');
      return {} as never;
    });
    vi.mocked(recordConsent).mockImplementation(async () => {
      order.push('consent');
    });

    expect(await resolveConsent(userId, 'a@example.com', POLICY_VERSION)).toBe('allow');
    expect(recordConsent).toHaveBeenCalledWith(userId, POLICY_VERSION, 'sign_in');
    // The consent row hangs from the profile by FK; the other order fails on
    // a first sign-in.
    expect(order).toEqual(['profile', 'consent']);
  });

  it('asks, and records nothing, when there is no consent and no box', async () => {
    vi.mocked(hasConsent).mockResolvedValue(false);

    expect(await resolveConsent(userId, 'a@example.com', undefined)).toBe('ask');
    expect(recordConsent).not.toHaveBeenCalled();
  });

  it('records an acceptance from the authorisation screen as the gate', async () => {
    await acceptPolicy(userId, 'a@example.com');

    expect(ensureProfile).toHaveBeenCalledWith(userId, 'a@example.com');
    expect(recordConsent).toHaveBeenCalledWith(userId, POLICY_VERSION, 'gate');
  });

  it('deletes the account through the profile, which cascades', async () => {
    await deleteAccountData(userId);

    expect(deleteProfile).toHaveBeenCalledWith(userId);
  });
});
