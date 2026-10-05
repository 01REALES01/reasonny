'use client';

import React, { useMemo, useState } from 'react';

import type { DayGroup, DashboardData } from '@/core/services/analytics.service';
import type { EnrichedTransactionRow } from '@/core/repositories/transaction.repository';

import { BalanceHero, GENERAL_CARD_ID, type FormattedWalletCard } from './balance-hero';
import { CaptureCallout } from './capture-callout';
import { FinancialActions } from './financial-actions';
import { PhoneLedger } from './phone-ledger';
import { ReviewCallout } from './review-callout';
import { WeekSpendingCard } from './week-spending';

interface DashboardExperienceProps {
  readonly data: DashboardData;
  readonly userEmail: string;
  readonly displayName: string | null;
}

// By id only. Matching on bank name or last four digits pulled one bank's
// other accounts into the filter (Bancolombia *1111 showed *2222's spends),
// and building a RegExp from an account name threw on names like "*1234".
function matchesAccount(tx: EnrichedTransactionRow, card: FormattedWalletCard): boolean {
  if (card.id === GENERAL_CARD_ID) return true;
  return tx.account?.id === card.id;
}

export function DashboardExperience({
  data,
  userEmail,
  displayName,
}: DashboardExperienceProps): React.ReactElement {
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [activeCard, setActiveCard] = useState<FormattedWalletCard | null>(null);

  const handleCardChange = (index: number, card: FormattedWalletCard) => {
    setActiveCardIndex(index);
    setActiveCard(card);
  };

  const isSpecificAccount = Boolean(activeCard && activeCard.id !== GENERAL_CARD_ID);

  // Filter recent movements by selected account
  const filteredRecentDays: DayGroup[] = useMemo(() => {
    if (!activeCard || !isSpecificAccount) {
      return data.recentDays;
    }
    return data.recentDays
      .map((group) => {
        const matchingTxs = group.transactions.filter((tx) => matchesAccount(tx, activeCard));
        if (matchingTxs.length === 0) return null;
        const groupExpense = matchingTxs
          .filter((tx) => tx.type === 'expense')
          .reduce((sum, tx) => sum + tx.amountMinor, 0n);
        return {
          ...group,
          totalExpenseMinor: groupExpense,
          transactions: matchingTxs,
        };
      })
      .filter((g): g is DayGroup => g !== null);
  }, [data.recentDays, isSpecificAccount, activeCard]);

  const handleClearAccountFilter = () => {
    setActiveCardIndex(0);
    setActiveCard(null);
  };

  return (
    <>
      {/* 1. Authentic Luxury Velvet Balance Hero with Live Sync Heartbeat & Card Stack */}
      <BalanceHero
        totalBalanceMinor={data.totalBalanceMinor}
        monthExpenseMinor={data.monthlyTotals.totalExpenseMinor}
        currency={data.baseCurrency}
        userEmail={userEmail}
        displayName={displayName}
        monthLabel={data.currentMonthLabel}
        uncategorizedCount={data.uncategorizedCount}
        lastCaptureAt={data.lastCaptureAt}
        autoCaptureCount={data.autoCaptureCount}
        timeZone={data.timezone}
        accounts={data.accounts}
        activeCardIndex={activeCardIndex}
        onCardChange={handleCardChange}
      />

      {/* Only until the pipe has actually delivered something */}
      {data.autoCaptureCount === 0 && <CaptureCallout />}

      {/* 2. Triage Callout: Appears only when there are items to categorize */}
      <ReviewCallout uncategorizedCount={data.uncategorizedCount} />

      {/* 3. This week's spending, day by day, with today and the month */}
      <WeekSpendingCard
        week={data.week}
        monthExpenseMinor={data.monthlyTotals.totalExpenseMinor}
        currency={data.baseCurrency}
      />

      {/* 4. Purposeful Financial Actions (+ Registrar gasto, + Ingreso) */}
      <FinancialActions />

      {/* 5. Recent transactions filtered by selected card, or showing all */}
      <PhoneLedger
        days={filteredRecentDays}
        currency={data.baseCurrency}
        timeZone={data.timezone}
        activeAccountFilterName={isSpecificAccount && activeCard ? activeCard.displayName : null}
        onClearAccountFilter={handleClearAccountFilter}
      />
    </>
  );
}
