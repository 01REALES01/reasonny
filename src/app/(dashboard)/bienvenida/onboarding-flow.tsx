'use client';

import { useRouter } from 'next/navigation';
import React, { useState, useTransition } from 'react';

import { updateDisplayNameAction } from '@/app/actions/profile';
import { CategoryIcon } from '@/components/ui/category-icon';
import { t } from '@/lib/i18n';

interface OnboardingFlowProps {
  readonly initialName: string;
  readonly baseCurrency: string;
}

type Step = 'welcome' | 'name' | 'how';

/**
 * First-run introduction.
 *
 * Three screens, and the only one that writes anything is the name. Onboarding
 * that asks for a budget, a savings goal and a set of categories before the
 * user has recorded a single expense is asking them to plan a life they have
 * not measured yet - and Phase 1 has nothing to do with any of those answers.
 *
 * Every step can be skipped. The app has to work for someone who taps past all
 * of it, because most people will.
 */
export function OnboardingFlow({
  initialName,
  baseCurrency,
}: OnboardingFlowProps): React.ReactElement {
  const router = useRouter();
  const [step, setStep] = useState<Step>('welcome');
  const [name, setName] = useState(initialName);
  const [isPending, startTransition] = useTransition();

  function finish(): void {
    router.push('/dashboard');
  }

  function saveNameAndContinue(): void {
    startTransition(async () => {
      // A failure here is not worth blocking the flow over: the name is a
      // convenience, and /perfil can set it later.
      await updateDisplayNameAction(name);
      setStep('how');
    });
  }

  return (
    <div className="ob">
      <div className="ob-progress" aria-hidden="true">
        {(['welcome', 'name', 'how'] as const).map((s) => (
          <span
            key={s}
            className={`ob-pip${s === step ? ' ob-pip--on' : ''}`}
          />
        ))}
      </div>

      {step === 'welcome' && (
        <div className="step-slide ob-panel">
          <span className="ob-mark" aria-hidden="true" />
          <h1 className="ob-title">{t('ob_welcome_title')}</h1>
          <p className="ob-text">{t('ob_welcome_text')}</p>

          <button
            type="button"
            onClick={() => setStep('name')}
            className="entry-submit"
          >
            {t('ob_start')}
          </button>
          <button type="button" onClick={finish} className="ob-skip">
            {t('ob_skip')}
          </button>
        </div>
      )}

      {step === 'name' && (
        <div className="step-slide ob-panel">
          <h1 className="ob-title">{t('ob_name_title')}</h1>
          <p className="ob-text">{t('ob_name_text')}</p>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('profile_name_placeholder')}
            maxLength={60}
            autoComplete="name"
            className="entry-input"
            aria-label={t('profile_name_label')}
          />

          <button
            type="button"
            onClick={saveNameAndContinue}
            disabled={isPending}
            className="entry-submit"
          >
            {isPending ? t('saving') : t('ob_continue')}
          </button>
          <button type="button" onClick={() => setStep('how')} className="ob-skip">
            {t('ob_skip_step')}
          </button>
        </div>
      )}

      {step === 'how' && (
        <div className="step-slide ob-panel">
          <h1 className="ob-title">{t('ob_how_title')}</h1>

          <ul className="ob-list">
            <li className="ob-list-item">
              <span className="ob-list-icon" aria-hidden="true">
                <CategoryIcon name="Plus" size={16} />
              </span>
              <div>
                <strong>{t('ob_how_1_title')}</strong>
                <span>{t('ob_how_1_text')}</span>
              </div>
            </li>
            <li className="ob-list-item">
              <span className="ob-list-icon" aria-hidden="true">
                <CategoryIcon name="PieChart" size={16} />
              </span>
              <div>
                <strong>{t('ob_how_2_title')}</strong>
                <span>{t('ob_how_2_text')}</span>
              </div>
            </li>
            <li className="ob-list-item">
              <span className="ob-list-icon" aria-hidden="true">
                <CategoryIcon name="ShieldCheck" size={16} />
              </span>
              <div>
                <strong>{t('ob_how_3_title')}</strong>
                <span>
                  {t('ob_how_3_text')} {baseCurrency}.
                </span>
              </div>
            </li>
          </ul>

          <button type="button" onClick={finish} className="entry-submit">
            {t('ob_finish')}
          </button>
        </div>
      )}
    </div>
  );
}
