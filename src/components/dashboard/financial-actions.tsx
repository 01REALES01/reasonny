import Link from 'next/link';
import React from 'react';

import { CategoryIcon } from '@/components/ui/category-icon';

/**
 * Two purposeful financial action buttons:
 * - "+ Registrar gasto" (Primary action)
 * - "+ Ingreso" (Secondary action)
 */
export function FinancialActions(): React.ReactElement {
  return (
    <div className="fin-actions-row">
      <Link href="/nuevo" className="fin-action-btn fin-action-btn--primary">
        <CategoryIcon name="Plus" size={16} />
        <span>Registrar gasto</span>
      </Link>

      <Link
        href="/nuevo?type=income"
        className="fin-action-btn fin-action-btn--secondary"
      >
        <CategoryIcon name="TrendingUp" size={15} />
        <span>Ingreso</span>
      </Link>
    </div>
  );
}
