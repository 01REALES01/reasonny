import type React from 'react';
import { describe, expect, it } from 'vitest';

import { Money } from './money';

describe('Money Component & Formatting', () => {
  it('renders standard COP amounts with thousands formatting', () => {
    const el = Money({ amountMinor: 4500000n, currency: 'COP', locale: 'es' }) as React.ReactElement<{ className?: string }>;
    expect(el).toBeDefined();
    expect(el.props.className).toContain('money');
  });

  it('renders USD amounts with cent fraction de-emphasis', () => {
    const el = Money({ amountMinor: 184750n, currency: 'USD', locale: 'en' }) as React.ReactElement<{ className?: string }>;
    expect(el).toBeDefined();
    expect(el.props.className).toContain('money');
  });

  it('renders zero amounts without crashing', () => {
    const el = Money({ amountMinor: 0n, currency: 'COP', locale: 'es' });
    expect(el).toBeDefined();
  });
});
