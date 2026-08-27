/**
 * Internationalization (i18n) dictionary and formatters.
 *
 * All UI strings and currency/date formatting must flow through this module
 * to prevent ad-hoc hardcoded literals and ensure locale consistency.
 */

export type Locale = 'es' | 'en';

export const DEFAULT_LOCALE: Locale = 'es';

export const DICTIONARY = {
  es: {
    // Navigation & Common
    app_name: 'RealMoney',
    save: 'Guardar',
    saving: 'Guardando…',
    cancel: 'Cancelar',
    back: 'Volver',
    loading: 'Cargando…',
    error_generic: 'Ocurrió un error inesperado. Inténtalo de nuevo.',

    // Quick Add
    quick_add_title: 'Nuevo Registro',
    quick_add_subtitle: 'Registra un gasto o ingreso en segundos',
    field_amount: 'Monto',
    field_amount_placeholder: '0',
    field_merchant: 'Comercio o Concepto',
    field_merchant_placeholder: 'Ej. Juan Valdez, Supermercado, Taxi…',
    field_category: 'Categoría',
    field_account: 'Cuenta',
    field_type_expense: 'Gasto',
    field_type_income: 'Ingreso',
    field_date: 'Fecha',
    field_note: 'Nota opcional',
    field_note_placeholder: 'Detalles adicionales…',
    btn_submit_transaction: 'Guardar Transacción',
    transaction_created_success: 'Transacción registrada correctamente',
    validation_amount_positive: 'El monto debe ser mayor a 0.',
    validation_merchant_required: 'El nombre del comercio es obligatorio.',
    no_categories_available: 'Sin categorías disponibles',
    no_accounts_available: 'Cuenta principal (predeterminada)',
  },
  en: {
    // Navigation & Common
    app_name: 'RealMoney',
    save: 'Save',
    saving: 'Saving…',
    cancel: 'Cancel',
    back: 'Back',
    loading: 'Loading…',
    error_generic: 'An unexpected error occurred. Please try again.',

    // Quick Add
    quick_add_title: 'New Transaction',
    quick_add_subtitle: 'Record an expense or income in seconds',
    field_amount: 'Amount',
    field_amount_placeholder: '0',
    field_merchant: 'Merchant or Concept',
    field_merchant_placeholder: 'E.g. Coffee shop, Grocery, Taxi…',
    field_category: 'Category',
    field_account: 'Account',
    field_type_expense: 'Expense',
    field_type_income: 'Income',
    field_date: 'Date',
    field_note: 'Optional note',
    field_note_placeholder: 'Additional details…',
    btn_submit_transaction: 'Save Transaction',
    transaction_created_success: 'Transaction recorded successfully',
    validation_amount_positive: 'Amount must be greater than 0.',
    validation_merchant_required: 'Merchant name is required.',
    no_categories_available: 'No categories available',
    no_accounts_available: 'Main Account (Default)',
  },
} as const;

export type TranslationKey = keyof typeof DICTIONARY.es;

export function t(key: TranslationKey, locale: Locale = DEFAULT_LOCALE): string {
  const table = DICTIONARY[locale] ?? DICTIONARY.es;
  return table[key] ?? DICTIONARY.es[key] ?? key;
}

export function formatDate(
  date: Date | string | number,
  locale: Locale = DEFAULT_LOCALE,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === 'object' ? date : new Date(date);
  const localeTag = locale === 'es' ? 'es-CO' : 'en-US';
  return new Intl.DateTimeFormat(
    localeTag,
    options ?? {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    },
  ).format(d);
}
