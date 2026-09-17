import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { CategoryBreakdownPanel } from '@/components/dashboard/category-breakdown-panel';
import { PhoneLedger } from '@/components/dashboard/phone-ledger';
import { CategoryIcon } from '@/components/ui/category-icon';
import { Money } from '@/components/ui/money';
import { ensureProfile } from '@/core/repositories/profile.repository';
import { getMonthViewData } from '@/core/services/analytics.service';
import { toUserId } from '@/core/types';
import { t } from '@/lib/i18n';
import { getCurrentUser } from '@/lib/session';

// P8: Authenticated app is strictly noindex
export const metadata: Metadata = {
  title: 'Mes — Reasonny',
  robots: { index: false, follow: false },
};

export default async function MonthPage(props: {
  searchParams: Promise<{ offset?: string }>;
}): Promise<React.ReactElement> {
  const session = await getCurrentUser();
  if (!session) {
    redirect('/sign-in');
  }

  const [{ offset: rawOffset }, userId] = [
    await props.searchParams,
    toUserId(session.id),
  ];
  await ensureProfile(userId, session.email);

  // Number() on an absent or malformed param yields NaN, which would propagate
  // into the month arithmetic as an Invalid Date; 0 is the sane fallback.
  const parsed = Number(rawOffset);
  const offset = Number.isFinite(parsed) ? parsed : 0;

  const data = await getMonthViewData(userId, offset);

  return (
    <main className="entry-page entry-page--mes">
      <div className="entry">
        <div className="entry-bar">
          <Link href="/dashboard" className="entry-back">
            <CategoryIcon name="ArrowLeft" size={15} />
            <span>{t('back')}</span>
          </Link>
        </div>

        {/* Older is always reachable; newer only when there is a newer month,
            so the control never offers a month that cannot have data. */}
        <nav className="month-switch" aria-label={t('month_nav')}>
          <Link
            href={`/mes?offset=${data.offset - 1}`}
            className="month-switch-btn"
            aria-label={t('month_previous')}
          >
            <CategoryIcon name="ArrowLeft" size={16} />
          </Link>

          <span className="month-switch-label">{data.monthLabel}</span>

          {data.isCurrentMonth ? (
            <span className="month-switch-btn month-switch-btn--disabled" aria-hidden="true">
              <CategoryIcon name="ArrowRight" size={16} />
            </span>
          ) : (
            <Link
              href={`/mes?offset=${data.offset + 1}`}
              className="month-switch-btn"
              aria-label={t('month_next')}
            >
              <CategoryIcon name="ArrowRight" size={16} />
            </Link>
          )}
        </nav>

        <div className="month-totals">
          <div className="month-total">
            <span className="fin-stat-label">{t('stat_expenses')}</span>
            <span className="month-total-value">
              <Money
                amountMinor={data.monthlyTotals.totalExpenseMinor}
                currency={data.baseCurrency}
              />
            </span>
          </div>
          <div className="month-total">
            <span className="fin-stat-label">{t('stat_income')}</span>
            <span className="month-total-value month-total-value--income">
              <Money
                amountMinor={data.monthlyTotals.totalIncomeMinor}
                currency={data.baseCurrency}
              />
            </span>
          </div>
        </div>

        <CategoryBreakdownPanel
          breakdown={data.categoryBreakdown}
          totalExpenseMinor={data.monthlyTotals.totalExpenseMinor}
          currency={data.baseCurrency}
        />

        <PhoneLedger days={data.days} currency={data.baseCurrency} />
      </div>
    </main>
  );
}
