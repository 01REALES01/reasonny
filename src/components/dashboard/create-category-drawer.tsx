'use client';

import React, { useState, useTransition } from 'react';

import { createCategoryAction } from '@/app/actions/category';
import { CategoryIcon } from '@/components/ui/category-icon';
import type { CategoryRow, CategoryType } from '@/core/repositories/category.repository';
import { CATEGORY_PALETTE, DEFAULT_CATEGORY_COLOR } from '@/lib/category-palette';

interface CreateCategoryDrawerProps {
  readonly isOpen: boolean;
  readonly type: CategoryType;
  readonly onClose: () => void;
  readonly onCategoryCreated: (category: CategoryRow) => void;
}

const AVAILABLE_ICONS = [
  'Tag',
  'ShoppingCart',
  'Utensils',
  'Coffee',
  'Car',
  'Fuel',
  'Home',
  'HeartPulse',
  'Dumbbell',
  'Tv',
  'Music',
  'ShoppingBag',
  'CreditCard',
  'Briefcase',
  'GraduationCap',
  'Plane',
  'Gift',
  'Sparkles',
] as const;

export function CreateCategoryDrawer({
  isOpen,
  type,
  onClose,
  onCategoryCreated,
}: CreateCategoryDrawerProps): React.ReactElement | null {
  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState<string>('Tag');
  // The hex is the value, the CSS variable only paints it. Storing the hex is
  // what the column can hold and what every other client can read.
  const [selectedColor, setSelectedColor] = useState<string>(
    CATEGORY_PALETTE[0]?.hex ?? DEFAULT_CATEGORY_COLOR,
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedSwatch = CATEGORY_PALETTE.find((col) => col.hex === selectedColor);

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Escribe un nombre para la categoría');
      return;
    }

    startTransition(async () => {
      const res = await createCategoryAction({
        name: name.trim(),
        type,
        icon: selectedIcon,
        color: selectedColor,
      });

      if (!res.success || !res.category) {
        setError(res.error ?? 'No se pudo crear la categoría');
        return;
      }

      setName('');
      onCategoryCreated(res.category);
    });
  }

  return (
    <div className="category-drawer-root" role="dialog" aria-modal="true" aria-label="Crear categoría">
      <div className="category-drawer-scrim" onClick={onClose} aria-hidden="true" />

      <div className="category-drawer-sheet">
        <div className="category-drawer-handle-wrap">
          <div className="category-drawer-handle" />
        </div>

        <div className="category-drawer-header">
          <div className="category-drawer-title-wrap">
            <h2 className="category-drawer-title">Nueva Categoría</h2>
            <p className="category-drawer-subtitle">
              {type === 'income' ? 'Para tus ingresos' : 'Para tus gastos diarios'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="category-drawer-close"
            aria-label="Cerrar modal"
          >
            <CategoryIcon name="X" size={16} />
          </button>
        </div>

        {error && (
          <div role="alert" className="category-drawer-error">
            ⚠ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="category-drawer-form">
          {/* Preview Squircle Tile */}
          <div className="category-drawer-preview-wrap">
            <div
              className="category-drawer-preview-tile"
              style={
                {
                  '--cat-preview-color': selectedSwatch?.cssVar ?? selectedColor,
                } as React.CSSProperties
              }
            >
              <CategoryIcon name={selectedIcon} size={24} />
            </div>
            <div className="category-drawer-preview-meta">
              <span className="category-drawer-preview-name">{name.trim() || 'Nombre de categoría'}</span>
              <span className="category-drawer-preview-hint">Vista previa en vivo</span>
            </div>
          </div>

          {/* Name Field */}
          <div className="category-drawer-field">
            <label htmlFor="cat-name-input" className="category-drawer-label">
              Nombre
            </label>
            <input
              id="cat-name-input"
              type="text"
              placeholder="Ej. Gimnasio, Mascotas, Café..."
              value={name}
              maxLength={40}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              className="entry-input category-drawer-input"
            />
          </div>

          {/* Icon Picker */}
          <div className="category-drawer-field">
            <label className="category-drawer-label">Icono</label>
            <div className="category-drawer-icons-grid" role="radiogroup" aria-label="Seleccionar icono">
              {AVAILABLE_ICONS.map((iconName) => {
                const isSelected = selectedIcon === iconName;
                return (
                  <button
                    key={iconName}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={iconName}
                    onClick={() => setSelectedIcon(iconName)}
                    className={`category-drawer-icon-btn${
                      isSelected ? ' category-drawer-icon-btn--selected' : ''
                    }`}
                  >
                    <CategoryIcon name={iconName} size={18} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color Picker */}
          <div className="category-drawer-field">
            <label className="category-drawer-label">Color distintivo</label>
            <div className="category-drawer-colors-row" role="radiogroup" aria-label="Seleccionar color">
              {CATEGORY_PALETTE.map((col) => {
                const isSelected = selectedColor === col.hex;
                return (
                  <button
                    key={col.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={col.label}
                    onClick={() => setSelectedColor(col.hex)}
                    className={`category-drawer-color-swatch${
                      isSelected ? ' category-drawer-color-swatch--selected' : ''
                    }`}
                    style={{ '--swatch-color': col.cssVar } as React.CSSProperties}
                  >
                    {isSelected && <span className="category-drawer-color-check" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isPending}
            className="entry-submit category-drawer-submit"
          >
            {isPending ? 'Creando...' : 'Crear y Seleccionar'}
          </button>
        </form>
      </div>
    </div>
  );
}
