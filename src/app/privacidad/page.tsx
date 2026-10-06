import type { Metadata } from 'next';
import Link from 'next/link';
import React from 'react';

import { PRIVACY_POLICY } from '@/content/privacy-policy';
import { DEFAULT_LOCALE, t } from '@/lib/i18n';

const policy = PRIVACY_POLICY[DEFAULT_LOCALE];

/**
 * Public and indexable (P8): the law wants the policy available to anyone
 * before they hand over a single datum, not only behind the sign-in. Static -
 * it reads no session - so it costs the server nothing and loads like the
 * landing.
 */
export const metadata: Metadata = {
  title: `${policy.title} — Reasonny`,
  description: policy.description,
  alternates: {
    canonical: '/privacidad',
    languages: { 'es-CO': '/privacidad', 'x-default': '/privacidad' },
  },
};

export default function PrivacyPolicyPage(): React.ReactElement {
  return (
    <main className="legal-page">
      <article className="legal-doc">
        <Link href="/" className="legal-back">
          ← {t('legal_back_home')}
        </Link>
        <header className="legal-header">
          <h1 className="legal-title">{policy.title}</h1>
          <p className="legal-effective">{policy.effective}</p>
          <p className="legal-intro">{policy.intro}</p>
        </header>

        {policy.sections.map((section) => (
          <section key={section.id} id={section.id} className="legal-section">
            <h2 className="legal-heading">{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="legal-text">
                {paragraph}
              </p>
            ))}
            {section.items && (
              <ul className="legal-list">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </article>
    </main>
  );
}
