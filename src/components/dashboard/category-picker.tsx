'use client';

import React from 'react';

import { CategoryIcon } from '@/components/ui/category-icon';
import type { CategoryRow } from '@/core/repositories/category.repository';

interface CategoryPickerProps {
  readonly categories: CategoryRow[];
  readonly selectedId: string | null;
  readonly onSelect: (categoryId: string) => void;
  readonly disabled?: boolean;
  /** Labels the grid for assistive technology; the visible label is the caller's. */
  readonly ariaLabel: string;
}

/**
 * The category grid, shared by the review queue and the transaction detail.
 *
 * WHY A GRID OF TILES AND NOT THE ROW OF PILLS IT REPLACED
 * -------------------------------------------------------
 * The pills were a single line that ran off the edge of the screen, so
 * choosing a category meant dragging sideways through fourteen of them to find
 * one - on the two screens whose entire job is choosing a category. A grid
 * wraps, so every option is on screen at once and nothing is discovered by
 * scrolling.
 *
 * The colour alone was also doing all the identifying work. Every category
 * already stores a Lucide icon name, and the same tile is what /nuevo draws,
 * so showing it here makes the three screens one system rather than three
 * dialects - and an icon is recognised before a colour is matched.
 */
export function CategoryPicker({
  categories,
  selectedId,
  onSelect,
  disabled = false,
  ariaLabel,
}: CategoryPickerProps): React.ReactElement {
  return (
    <div className="category-picker" role="group" aria-label={ariaLabel}>
      {categories.map((cat) => {
        const isSelected = selectedId === cat.id;
        return (
          <button
            key={cat.id}
            type="button"
            disabled={disabled}
            aria-pressed={isSelected}
            onClick={() => onSelect(cat.id)}
            className={`entry-category-tile${isSelected ? ' entry-category-tile--selected' : ''}`}
            style={(cat.color ? { '--cat-tile-ink': cat.color } : {}) as React.CSSProperties}
          >
            <div className="entry-category-tile-icon">
              <CategoryIcon name={cat.icon} size={19} />
            </div>
            <span className="entry-category-tile-name">{cat.name}</span>
          </button>
        );
      })}
    </div>
  );
}
