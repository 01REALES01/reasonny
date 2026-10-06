import { describe, expect, it } from 'vitest';

import { decideConsent, POLICY_VERSION } from './privacy';

describe('decideConsent', () => {
  it('lets in whoever already accepted this version', () => {
    expect(decideConsent({ hasCurrentConsent: true, intentVersion: undefined })).toBe('allow');
  });

  it('records the box ticked at sign-in instead of asking again', () => {
    expect(decideConsent({ hasCurrentConsent: false, intentVersion: POLICY_VERSION })).toBe(
      'record_from_sign_in',
    );
  });

  it('asks when there is nothing on record and no box was ticked', () => {
    expect(decideConsent({ hasCurrentConsent: false, intentVersion: undefined })).toBe('ask');
  });

  it('does not count a box ticked next to an older policy', () => {
    expect(decideConsent({ hasCurrentConsent: false, intentVersion: '2000-01-01' })).toBe('ask');
  });
});
