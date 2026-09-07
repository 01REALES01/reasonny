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
    app_name: 'Reasonny',
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
    field_amount_preview: 'Vista previa:',
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
    account_cash: 'Efectivo',

    // Dashboard
    hero_total_balance: 'Saldo total disponible',
    hero_realtime: 'Actualizado en tiempo real',
    hero_new_expense: 'Nuevo gasto',
    nav_home: 'Inicio',
    nav_new: 'Nuevo',
    dashboard_pending_review: 'por revisar',
    dashboard_export_csv: 'CSV',
    dashboard_export_csv_title: 'Exportar todas las transacciones a CSV',
    dashboard_recent_title: 'Últimos movimientos',
    dashboard_add: 'Añadir',
    dashboard_empty: 'Aún no hay transacciones registradas este mes.',
    dashboard_empty_cta: 'Registrar primer gasto',
    monthly_spend_in: 'Gasto en',
    monthly_records: 'registros',
    monthly_income: 'Ingresos',
    breakdown_title: 'Distribución por categoría',
    uncategorized: 'Sin categorizar',
    transaction_type: 'Tipo de transacción',
    record_expense: 'Registrar gasto',
    record_income: 'Registrar ingreso',
    view_on_home: 'Ver en inicio',
    artwork_alt: 'Escultura brutalista de Reasonny',
    field_email: 'Correo electrónico',
    field_code: 'Código de un solo uso',

    // Sign-in — the immersive entry. Carries the Reasonny narrative (reason +
    // money) over the autoplaying claw/card video.
    auth_hero_line_1: 'Razón y dinero,',
    auth_hero_line_2: 'en el mismo lugar.',
    auth_hero_subtitle:
      'Registra tus gastos con casi cero esfuerzo. El sistema interpreta, clasifica y te dice lo que importa.',
    auth_enter: 'Entrar a Reasonny',
    auth_email_title: 'Tu Correo',
    auth_email_subtitle: 'Te enviaremos un código seguro de un solo uso.',
    auth_email_placeholder: 'tu@correo.com',
    auth_send_code: 'Enviar Código',
    auth_sending: 'Enviando código…',
    auth_send_failed: 'No se pudo enviar el código.',
    auth_code_title: 'Verifica tu Código',
    auth_code_subtitle: 'Ingresa el código enviado a',
    auth_verify: 'Acceder al Dashboard',
    auth_verifying: 'Verificando…',
    auth_code_invalid: 'El código ingresado es incorrecto.',
    auth_change_email: 'Cambiar de correo',
  },
  en: {
    // Navigation & Common
    app_name: 'Reasonny',
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
    field_amount_preview: 'Preview:',
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
    account_cash: 'Cash',

    // Dashboard
    hero_total_balance: 'Total available balance',
    hero_realtime: 'Updated in real time',
    hero_new_expense: 'New expense',
    nav_home: 'Home',
    nav_new: 'New',
    dashboard_pending_review: 'to review',
    dashboard_export_csv: 'CSV',
    dashboard_export_csv_title: 'Export every transaction to CSV',
    dashboard_recent_title: 'Recent activity',
    dashboard_add: 'Add',
    dashboard_empty: 'No transactions recorded this month yet.',
    dashboard_empty_cta: 'Record your first expense',
    monthly_spend_in: 'Spending in',
    monthly_records: 'records',
    monthly_income: 'Income',
    breakdown_title: 'Breakdown by category',
    uncategorized: 'Uncategorized',
    transaction_type: 'Transaction type',
    record_expense: 'Record expense',
    record_income: 'Record income',
    view_on_home: 'View on home',
    artwork_alt: 'Reasonny brutalist sculpture',
    field_email: 'Email address',
    field_code: 'One-time code',

    // Sign-in — the immersive entry.
    auth_hero_line_1: 'Reason and money,',
    auth_hero_line_2: 'in one place.',
    auth_hero_subtitle:
      'Log your spending with almost zero effort. The system reads it, files it, and tells you what matters.',
    auth_enter: 'Enter Reasonny',
    auth_email_title: 'Your Email',
    auth_email_subtitle: "We'll send you a secure one-time code.",
    auth_email_placeholder: 'you@email.com',
    auth_send_code: 'Send Code',
    auth_sending: 'Sending code…',
    auth_send_failed: 'The code could not be sent.',
    auth_code_title: 'Verify Your Code',
    auth_code_subtitle: 'Enter the code sent to',
    auth_verify: 'Go to Dashboard',
    auth_verifying: 'Verifying…',
    auth_code_invalid: 'That code is not correct.',
    auth_change_email: 'Use another email',
  },
} as const;

export type TranslationKey = keyof typeof DICTIONARY.es;

/**
 * The `?? DICTIONARY.es[key] ?? key` tail is gone; the locale guard is not.
 *
 * Those are two different fallbacks and only one of them was dead. The KEY is
 * compile-checked: TranslationKey derives from the Spanish table and `as const`
 * gives both tables literal types, so a key present in one half and missing
 * from the other is a type error - which is exactly how the sign-in keys were
 * caught while being added. That fallback could never fire.
 *
 * The LOCALE is not compile-checked wherever it crosses a trust boundary: a
 * `lang` cookie, an Accept-Language header, a URL segment, or the timezone-like
 * column a profile row will carry. Any of those reaches this function through a
 * cast, and `DICTIONARY['fr']` is undefined - so dropping this `??` would turn
 * a mistranslated label into a TypeError, which in a Server Component is a 500
 * on the dashboard.
 */
export function t(key: TranslationKey, locale: Locale = DEFAULT_LOCALE): string {
  return (DICTIONARY[locale] ?? DICTIONARY[DEFAULT_LOCALE])[key];
}

export function formatDate(
  date: Date | string | number,
  locale: Locale = DEFAULT_LOCALE,
  options?: Intl.DateTimeFormatOptions,
): string {
  // new Date() accepts a Date as well as a string or a number, so no branch.
  const d = new Date(date);
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
