'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useRef, useState, useTransition } from 'react';

import { createQuickTransactionAction } from '@/app/actions/transactions';
import { CreateCategoryDrawer } from '@/components/dashboard/create-category-drawer';
import { AnimatedCheck } from '@/components/ui/animated-check';
import { CategoryIcon } from '@/components/ui/category-icon';
import { Money } from '@/components/ui/money';
import { parseMoney, SCALE } from '@/core/money';
import type { AccountRow } from '@/core/repositories/account.repository';
import type { CategoryRow } from '@/core/repositories/category.repository';
import { t } from '@/lib/i18n';
import { reportManualEntryDuration, startTiming } from '@/lib/telemetry';

interface QuickAddFormProps {
  readonly accounts: AccountRow[];
  readonly categories: CategoryRow[];
  readonly initialType?: 'expense' | 'income';
  /** Where the wizard opens. 1 when the link already answered step 0. */
  readonly initialStep?: number;
  /** From the profile. False means the browser is never even asked. */
  readonly locationEnabled: boolean;
}

const QUICK_AMOUNTS = ['10000', '20000', '50000', '100000'] as const;

/**
 * The keypad, laid out the way a phone lays one out.
 *
 * '000' earns its key in COP: nothing here costs less than a thousand pesos,
 * so it is the difference between four taps and one on every single entry.
 */
const KEYPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0'] as const;

/** Past this the number stops being money and starts being a typo. */
const MAX_AMOUNT_DIGITS = 12;

export function QuickAddForm({
  accounts,
  categories: initialCategories,
  initialType = 'expense',
  initialStep = 0,
  locationEnabled,
}: QuickAddFormProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Multi-step machine state
  const [currentStep, setCurrentStep] = useState<number>(initialStep);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');

  // Form states
  const [type, setType] = useState<'expense' | 'income'>(initialType);
  // Whole pesos, digits only. The keypad is the only way in, so there is no
  // free text to sanitise and no separator to parse back out - which is also
  // what killed the misalignment: the figure is now rendered text, not an
  // <input> being asked to look like a headline.
  const [amountDigits, setAmountDigits] = useState('');
  const [merchant, setMerchant] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    accounts[0]?.id ?? '',
  );
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  // Dynamic category list (allows instant addition from Drawer)
  const [categoryList, setCategoryList] = useState<CategoryRow[]>(initialCategories);
  const [isCategoryDrawerOpen, setIsCategoryDrawerOpen] = useState(false);

  const stopTimingRef = useRef<(() => number) | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    stopTimingRef.current = startTiming();
    if (locationEnabled) {
      requestLocation();
    }
  }, [locationEnabled]);

  const locationRef = useRef<{
    latitude: number;
    longitude: number;
    accuracyM: number;
  } | null>(null);
  const locationAskedRef = useRef(false);

  function requestLocation(): void {
    if (!locationEnabled || locationAskedRef.current) return;
    locationAskedRef.current = true;

    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        locationRef.current = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyM: Math.round(position.coords.accuracy),
        };
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  // A desktop keyboard should still work on a screen built for thumbs. The
  // effect re-subscribes on every digit so the Enter branch always closes over
  // the current amount rather than the one at mount.
  useEffect(() => {
    if (currentStep !== 1) return undefined;

    function handleKey(event: KeyboardEvent) {
      if (event.key >= '0' && event.key <= '9') {
        pushDigits(event.key);
      } else if (event.key === 'Backspace') {
        popDigit();
      } else if (event.key === 'Enter') {
        handleAmountContinue();
      } else {
        return;
      }
      event.preventDefault();
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, amountDigits]);

  // Navigation helpers
  // The message travels with the navigation on purpose: setting the error and
  // then calling goToStep cleared it on the way out, so a submit bounced back
  // to an earlier step with nothing on screen explaining why.
  function goToStep(
    nextStep: number,
    dir: 'forward' | 'backward',
    message: string | null = null,
  ) {
    setError(message);
    setDirection(dir);
    setCurrentStep(nextStep);
  }

  function handleBack() {
    // initialStep is the floor: a deep link that already chose the type never
    // reveals the step it skipped, it goes back where it came from.
    if (currentStep > initialStep) {
      goToStep(currentStep - 1, 'backward');
    } else {
      router.push('/dashboard');
    }
  }

  // Calculate continuous progress percentage (no steps numbers)
  const progressPercent =
    currentStep === 0 ? 15 : currentStep === 1 ? 38 : currentStep === 2 ? 62 : currentStep === 3 ? 84 : 100;

  const isIncome = type === 'income';
  const filteredCategories = categoryList.filter((c) => c.type === type);
  const selectedCategory = categoryList.find((c) => c.id === selectedCategoryId);

  // Still through parseMoney: every conversion from what a person entered into
  // minor units goes through the one module held to 100% coverage, even when
  // the input is already known to be clean digits.
  const previewMinor = amountDigits ? parseMoney(amountDigits, 'COP').minor : 0n;
  // The figure on screen goes through <Money> like every other amount in the
  // app: grouping, the decimal rule and tabular figures are its job, and a
  // second formatter here is how two numbers on one screen stop lining up.

  function handleTypeSelect(nextType: 'expense' | 'income') {
    setType(nextType);
    setSelectedCategoryId(null);
    setTimeout(() => {
      goToStep(1, 'forward');
    }, 120);
  }

  /**
   * The chip is labelled "+10.000" and now behaves like it: it adds to what is
   * already there instead of replacing it, so two taps make 20.000. Replacing
   * made the third tap undo the first two without saying so.
   */
  function handleQuickAmount(value: string) {
    const nextMinor = previewMinor + parseMoney(value, 'COP').minor;
    setAmountDigits(String(nextMinor / SCALE).slice(0, MAX_AMOUNT_DIGITS));
    setError(null);
    requestLocation();
  }

  function pushDigits(chunk: string) {
    // Leading zeros are dropped rather than rejected: '0' then '5' is someone
    // typing 5, not someone typing an octal.
    setAmountDigits((prev) => (prev + chunk).replace(/^0+/, '').slice(0, MAX_AMOUNT_DIGITS));
    setError(null);
    requestLocation();
  }

  function popDigit() {
    setAmountDigits((prev) => prev.slice(0, -1));
    setError(null);
  }

  function handleAmountContinue() {
    if (previewMinor <= 0n) {
      setError('Ingresa un monto válido mayor a 0');
      return;
    }
    setError(null);
    goToStep(2, 'forward');
  }

  function handleCategorySelect(catId: string) {
    // Selecting no longer advances. With fifteen targets on screen a mis-tap
    // used to cost a trip backwards, and the step that decides where the money
    // is filed is the last one that should move on its own.
    setSelectedCategoryId(catId);
    setError(null);
  }

  function handleMerchantContinue() {
    if (!merchant.trim()) {
      setError('Por favor indica en qué se gastó o el comercio');
      return;
    }
    setError(null);
    goToStep(4, 'forward');
  }

  function handleFinalSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setError(null);
    setSuccess(false);

    if (previewMinor <= 0n) {
      goToStep(1, 'backward', 'Monto inválido');
      return;
    }

    if (!merchant.trim()) {
      goToStep(3, 'backward', 'Nombre o comercio requerido');
      return;
    }

    startTransition(async () => {
      const result = await createQuickTransactionAction({
        amount: amountDigits,
        merchant,
        type,
        categoryId: selectedCategoryId,
        accountId: selectedAccountId || null,
        note: note.trim() || null,
        latitude: locationRef.current?.latitude ?? null,
        longitude: locationRef.current?.longitude ?? null,
        locationAccuracyM: locationRef.current?.accuracyM ?? null,
      });

      if (!result.success) {
        setError(result.error ?? t('error_generic'));
      } else {
        const elapsedMs = stopTimingRef.current?.();
        if (elapsedMs !== undefined) {
          reportManualEntryDuration(elapsedMs);
        }
        setSuccess(true);
        setTimeout(() => {
          router.push('/dashboard');
        }, 1400);
      }
    });
  }

  return (
    <div className="entry entry-wizard">
      {/* ── Continuous Top Progress Bar (Sin números de paso) ──────────────── */}
      <div className="entry-wizard-progress-wrap" aria-hidden="true">
        <div className="entry-wizard-progress-track">
          <div
            className={`entry-wizard-progress-fill${isIncome ? ' entry-wizard-progress-fill--income' : ''}`}
            style={{ transform: `scaleX(${progressPercent / 100})` }}
          />
        </div>
      </div>

      {/* ── Top Header Navigation Bar ──────────────────────────────────────── */}
      <div className="entry-bar entry-wizard-bar">
        <button
          type="button"
          onClick={handleBack}
          className="entry-back"
          aria-label={currentStep === 0 ? 'Volver al inicio' : 'Paso anterior'}
        >
          <CategoryIcon name="ArrowLeft" size={15} />
          <span>{currentStep === 0 ? t('back') : 'Atrás'}</span>
        </button>

        <div className="entry-wizard-step-tag">
          <span className="entry-wizard-step-dot" />
          <span className="entry-wizard-step-label">
            {currentStep === 0
              ? 'Tipo'
              : currentStep === 1
              ? 'Monto'
              : currentStep === 2
              ? 'Categoría'
              : currentStep === 3
              ? 'Nombre'
              : 'Confirmar'}
          </span>
        </div>
      </div>

      {/* ── Main Step Transition Container ─────────────────────────────────── */}
      <div
        key={currentStep}
        className={`entry-card entry-wizard-card step-slide step-slide--${direction}`}
      >
        {success && (
          <div role="status" className="entry-banner entry-banner--success entry-wizard-success-banner">
            <span className="entry-banner-msg">
              <AnimatedCheck size={24} />
              <span>¡Registro completado con éxito!</span>
            </span>
          </div>
        )}

        {error && (
          <div role="alert" className="entry-banner entry-banner--error">
            ⚠ {error}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            PASO 0: Tipo de Transacción (Gasto vs Ingreso)
            ════════════════════════════════════════════════════════════════════ */}
        {currentStep === 0 && (
          <div className="entry-step-pane">
            <div className="entry-step-header">
              <h1 className="entry-step-title">¿Qué deseas registrar?</h1>
              <p className="entry-step-desc">Selecciona si corresponde a un gasto o un ingreso recibido.</p>
            </div>

            <div className="entry-step-body entry-type-selector-grid">
              <button
                type="button"
                onClick={() => handleTypeSelect('expense')}
                className={`entry-type-card entry-type-card--expense${
                  !isIncome ? ' entry-type-card--active' : ''
                }`}
              >
                <div className="entry-type-card-icon-wrap">
                  <CategoryIcon name="ArrowUpRight" size={24} />
                </div>
                <div className="entry-type-card-meta">
                  <span className="entry-type-card-title">Gasto</span>
                  <span className="entry-type-card-sub">Compras, salidas, servicios, transporte</span>
                </div>
                <div className="entry-type-card-indicator" />
              </button>

              <button
                type="button"
                onClick={() => handleTypeSelect('income')}
                className={`entry-type-card entry-type-card--income${
                  isIncome ? ' entry-type-card--active' : ''
                }`}
              >
                <div className="entry-type-card-icon-wrap">
                  <CategoryIcon name="ArrowDownRight" size={24} />
                </div>
                <div className="entry-type-card-meta">
                  <span className="entry-type-card-title">Ingreso</span>
                  <span className="entry-type-card-sub">Salario, transferencias, ventas, rentas</span>
                </div>
                <div className="entry-type-card-indicator" />
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            PASO 1: Monto (cifra + teclado propio, sin teclado del sistema)
            ════════════════════════════════════════════════════════════════════ */}
        {currentStep === 1 && (
          <div className="entry-step-pane">
            <div className="entry-step-header">
              <h1 className="entry-step-title">
                {isIncome ? 'Monto a ingresar' : '¿Cuánto gastaste?'}
              </h1>
              <p className="entry-step-desc">
                Marca la cifra en el teclado o suma de a miles con los atajos.
              </p>
            </div>

            <div className="entry-amount-stage">
              <div
                className={`entry-amount-plate${isIncome ? ' entry-amount-plate--income' : ''}`}
                role="status"
                aria-live="polite"
              >
                <span
                  className={`entry-amount-value${
                    amountDigits ? '' : ' entry-amount-value--empty'
                  }`}
                >
                  <Money
                    amountMinor={previewMinor}
                    currency="COP"
                    showFractionDeEmphasis={false}
                  />
                </span>
              </div>

              {/* Quick Amount Chips */}
              <div className="entry-chips" role="group" aria-label="Montos rápidos sugeridos">
                {QUICK_AMOUNTS.map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleQuickAmount(val)}
                    className="entry-chip"
                  >
                    +
                    <Money
                      amountMinor={parseMoney(val, 'COP').minor}
                      currency="COP"
                      showFractionDeEmphasis={false}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="entry-keypad" role="group" aria-label="Teclado numérico">
              {KEYPAD_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => pushDigits(key)}
                  className={`entry-key${key === '000' ? ' entry-key--wide' : ''}`}
                >
                  {key}
                </button>
              ))}
              <button
                type="button"
                onClick={popDigit}
                disabled={!amountDigits}
                className="entry-key entry-key--erase"
                aria-label="Borrar el último dígito"
              >
                <CategoryIcon name="Delete" size={22} />
              </button>
            </div>

            <button
              type="button"
              onClick={handleAmountContinue}
              disabled={previewMinor <= 0n}
              className={`entry-submit entry-wizard-submit${
                isIncome ? ' entry-submit--income' : ''
              }`}
            >
              <span>Continuar</span>
              <CategoryIcon name="ArrowRight" size={16} />
            </button>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            PASO 2: Categoría (Squircles + Crear Categoría Drawer)
            ════════════════════════════════════════════════════════════════════ */}
        {currentStep === 2 && (
          <div className="entry-step-pane">
            <div className="entry-step-header">
              <h1 className="entry-step-title">Elige una categoría</h1>
              <p className="entry-step-desc">
                Toca para elegir y confirma abajo. También puedes crear una con tu
                propio icono y color.
              </p>
            </div>

            <div className="entry-step-body entry-categories entry-wizard-categories">
              {/* Botón "+ Nueva Categoría" */}
              <button
                type="button"
                onClick={() => setIsCategoryDrawerOpen(true)}
                className="entry-category-tile entry-category-tile--add"
              >
                <div className="entry-category-tile-icon entry-category-tile-icon--add">
                  <CategoryIcon name="Plus" size={20} />
                </div>
                <span className="entry-category-tile-name">+ Nueva</span>
              </button>

              {filteredCategories.map((cat) => {
                const isSelected = selectedCategoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => handleCategorySelect(cat.id)}
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

            <button
              type="button"
              onClick={() => goToStep(3, 'forward')}
              disabled={!selectedCategoryId}
              className={`entry-submit entry-wizard-submit${
                isIncome ? ' entry-submit--income' : ''
              }`}
            >
              <span>
                {selectedCategory ? `Confirmar ${selectedCategory.name}` : 'Elige una categoría'}
              </span>
              <CategoryIcon name="ArrowRight" size={16} />
            </button>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            PASO 3: Nombre / Comercio
            ════════════════════════════════════════════════════════════════════ */}
        {currentStep === 3 && (
          <div className="entry-step-pane">
            <div className="entry-step-header">
              <h1 className="entry-step-title">
                {isIncome ? '¿De dónde proviene?' : '¿En qué lo gastaste?'}
              </h1>
              <p className="entry-step-desc">
                Nombre del comercio, lugar o concepto del {isIncome ? 'ingreso' : 'gasto'}.
              </p>
            </div>

            <div className="entry-step-body entry-field entry-wizard-field">
              <label htmlFor="wizard-merchant" className="entry-label">
                {isIncome ? 'Concepto / Pagador' : 'Comercio o Lugar'}
              </label>
              <input
                id="wizard-merchant"
                name="merchant"
                type="text"
                ref={inputRef}
                autoFocus
                placeholder={
                  isIncome
                    ? 'Ej. Salario quincenal, Transferencia amigo, Venta...'
                    : 'Ej. Supermercado Éxito, Starbucks, Uber, Gasolina...'
                }
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleMerchantContinue();
                  }
                }}
                className="entry-input entry-wizard-input-lg"
              />
            </div>

            <button
              type="button"
              onClick={handleMerchantContinue}
              disabled={!merchant.trim()}
              className={`entry-submit entry-wizard-submit${
                isIncome ? ' entry-submit--income' : ''
              }`}
            >
              <span>Continuar a confirmación</span>
              <CategoryIcon name="ArrowRight" size={16} />
            </button>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            PASO 4: Resumen & Confirmación Final (Nota Opcional + Cuenta)
            ════════════════════════════════════════════════════════════════════ */}
        {currentStep === 4 && (
          <div className="entry-step-pane">
            <div className="entry-step-header">
              <h1 className="entry-step-title">Resumen de registro</h1>
              <p className="entry-step-desc">Verifica los datos y añade una nota opcional si lo deseas.</p>
            </div>

            <div className="entry-step-body entry-step-body--scroll">
            {/* Visual Summary Card */}
            <div className="entry-summary-card">
              <div className="entry-summary-amount-row">
                <span className="entry-summary-type-badge">
                  {isIncome ? 'Ingreso' : 'Gasto'}
                </span>
                <span className="entry-summary-amount">
                  <Money amountMinor={previewMinor} currency="COP" />
                </span>
              </div>

              <div className="entry-summary-details">
                <div className="entry-summary-item">
                  <span className="entry-summary-item-label">Concepto</span>
                  <span className="entry-summary-item-val">{merchant}</span>
                </div>

                <div className="entry-summary-item">
                  <span className="entry-summary-item-label">Categoría</span>
                  <span className="entry-summary-item-val entry-summary-category-pill">
                    {selectedCategory && (
                      <CategoryIcon name={selectedCategory.icon} size={13} />
                    )}
                    <span>{selectedCategory?.name ?? 'Sin categoría'}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Optional Note */}
            <div className="entry-field entry-wizard-field">
              <label htmlFor="wizard-note" className="entry-label">
                {t('field_note')} <span className="entry-hint-optional">(Opcional)</span>
              </label>
              <input
                id="wizard-note"
                name="note"
                type="text"
                placeholder="Ej. Almuerzo de trabajo con el equipo..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleFinalSubmit();
                  }
                }}
                className="entry-input"
              />
            </div>

            {/* Account Selector if multiple */}
            {accounts.length > 1 && (
              <div className="entry-field entry-wizard-field">
                <label htmlFor="wizard-account" className="entry-label">
                  {t('field_account')}
                </label>
                <select
                  id="wizard-account"
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="entry-select"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.currency})
                    </option>
                  ))}
                </select>
              </div>
            )}

            </div>

            {/* Final Submit Button */}
            <button
              type="button"
              onClick={() => handleFinalSubmit()}
              disabled={isPending || success}
              className={`entry-submit entry-wizard-submit${
                isIncome ? ' entry-submit--income' : ''
              }${success ? ' entry-submit--saved' : ''}`}
            >
              {isPending ? (
                t('saving')
              ) : success ? (
                <span className="entry-submit-success">
                  <AnimatedCheck size={18} />
                  <span>¡Registrado con éxito!</span>
                </span>
              ) : isIncome ? (
                '+ Registrar Ingreso'
              ) : (
                '+ Registrar Gasto'
              )}
            </button>
          </div>
        )}
      </div>

      {/* ── Bottom Drawer para Crear Nueva Categoría ───────────────────────── */}
      <CreateCategoryDrawer
        isOpen={isCategoryDrawerOpen}
        type={type}
        onClose={() => setIsCategoryDrawerOpen(false)}
        onCategoryCreated={(newCat) => {
          // Created and selected, but not confirmed: the new tile lands
          // highlighted in the grid so it is obvious which one it is, and the
          // same button moves on as for any other category.
          setCategoryList((prev) => [newCat, ...prev]);
          setSelectedCategoryId(newCat.id);
          setIsCategoryDrawerOpen(false);
        }}
      />
    </div>
  );
}
