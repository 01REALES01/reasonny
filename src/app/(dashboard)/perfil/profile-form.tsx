'use client';

import Link from 'next/link';
import React, { useState, useTransition } from 'react';

import { updateDisplayNameAction } from '@/app/actions/profile';
import { CategoryIcon } from '@/components/ui/category-icon';
import { t } from '@/lib/i18n';

interface ProfileFormProps {
  readonly email: string;
  readonly initialName: string;
  readonly baseCurrency: string;
  readonly timezone: string;
}

export function ProfileForm({
  email,
  initialName,
  baseCurrency,
  timezone,
}: ProfileFormProps): React.ReactElement {
  const [name, setName] = useState(initialName);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setError(null);
    setSaved(false);

    startTransition(async () => {
      const result = await updateDisplayNameAction(name);
      if (result.success) {
        setSaved(true);
      } else {
        setError(result.error ?? null);
      }
    });
  }

  return (
    <div className="entry">
      <div className="entry-bar">
        <Link href="/dashboard" className="entry-back">
          <CategoryIcon name="ArrowLeft" size={15} />
          <span>{t('back')}</span>
        </Link>
      </div>

      <div className="step-slide entry-card">
        <h1 className="profile-heading">{t('profile_title')}</h1>

        {saved && (
          <div role="status" className="entry-banner entry-banner--success">
            <span>{t('profile_saved')}</span>
          </div>
        )}

        {error && (
          <div role="alert" className="entry-banner entry-banner--error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="entry-form">
          <div className="entry-field">
            <label htmlFor="display-name" className="entry-label">
              {t('profile_name_label')}
            </label>
            <input
              id="display-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSaved(false);
              }}
              placeholder={t('profile_name_placeholder')}
              maxLength={60}
              autoComplete="name"
              className="entry-input"
            />
            <span className="entry-hint">{t('profile_name_hint')}</span>
          </div>

          <button type="submit" disabled={isPending} className="entry-submit">
            {isPending ? t('profile_saving') : t('profile_save')}
          </button>
        </form>
      </div>

      {/* Read-only for a reason. The email is issued by the identity provider,
          and currency and timezone are what every monetary aggregation groups
          by - changing either reinterprets history, so neither belongs behind a
          text field next to "what should we call you". */}
      <div className="profile-facts">
        <div className="profile-fact">
          <span className="profile-fact-label">{t('profile_email')}</span>
          <span className="profile-fact-value">{email}</span>
        </div>
        <div className="profile-fact">
          <span className="profile-fact-label">{t('profile_currency')}</span>
          <span className="profile-fact-value">{baseCurrency}</span>
        </div>
        <div className="profile-fact">
          <span className="profile-fact-label">{t('profile_timezone')}</span>
          <span className="profile-fact-value">{timezone}</span>
        </div>
      </div>
    </div>
  );
}
