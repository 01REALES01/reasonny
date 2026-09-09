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
    transaction_updated_success: 'Transacción actualizada correctamente',
    validation_amount_positive: 'El monto debe ser mayor a 0.',
    validation_merchant_required: 'El nombre del comercio es obligatorio.',
    no_categories_available: 'Sin categorías disponibles',
    no_accounts_available: 'Cuenta principal (predeterminada)',
    account_cash: 'Efectivo',

    // Dashboard
    hero_total_balance: 'Saldo total disponible',
    hero_realtime: 'Actualizado en tiempo real',
    hero_new_expense: 'Nuevo gasto',
    hero_hide_balance: 'Ocultar saldo',
    hero_show_balance: 'Mostrar saldo',
    hero_hide_short: 'Ocultar',
    hero_show_short: 'Mostrar',
    greeting: 'Hola',
    month_summary: 'Resumen de',
    balance_available: 'Saldo disponible',
    stat_expenses: 'Gastos',
    stat_income: 'Ingresos',
    stat_movements: 'Movimientos',
    stat_records_short: 'reg.',
    action_record_expense: 'Registrar gasto',
    action_record_income: 'Ingreso',
    nav_export: 'Exportar CSV',
    nav_main: 'Navegación principal',
    nav_notifications: 'Notificaciones',
    nav_profile: 'Perfil',

    // Perfil
    profile_title: 'Tu perfil',
    profile_name_label: '¿Cómo quieres que te llamemos?',
    profile_name_placeholder: 'Tu nombre',
    profile_name_hint: 'Es el nombre con el que te saluda la app. Si lo dejas vacío, usamos tu correo.',
    profile_save: 'Guardar',
    profile_saving: 'Guardando…',
    profile_saved: 'Listo, guardado.',
    profile_email: 'Correo',
    profile_currency: 'Moneda base',
    profile_timezone: 'Zona horaria',

    // Detalle y edición
    edit_title: 'Editar movimiento',
    delete_transaction: 'Eliminar este movimiento',
    delete_confirm: '¿Eliminar este movimiento? Dejará de contar en tus totales.',
    delete_confirm_yes: 'Sí, eliminar',

    // Por revisar
    review_title: 'Por revisar',
    review_lede: 'Toca una categoría para clasificar. Cada una que asignas mejora el desglose del mes.',
    review_open_detail: 'Ver detalle',
    review_clear_title: 'Todo al día',
    review_clear_text: 'No tienes movimientos sin categoría.',
    review_back_home: 'Volver al inicio',

    // Mes
    month_nav: 'Cambiar de mes',
    month_previous: 'Mes anterior',
    month_next: 'Mes siguiente',
    month_view: 'Ver el mes',

    // Bienvenida
    ob_welcome_title: 'Razón y dinero, en el mismo lugar.',
    ob_welcome_text: 'Reasonny registra lo que gastas con casi cero esfuerzo y te dice lo que importa, sin que tengas que buscarlo.',
    ob_start: 'Empezar',
    ob_skip: 'Saltar la bienvenida',
    ob_skip_step: 'Ahora no',
    ob_continue: 'Continuar',
    ob_name_title: '¿Cómo te llamamos?',
    ob_name_text: 'Solo para saludarte. Puedes cambiarlo cuando quieras desde tu perfil.',
    ob_how_title: 'Cómo funciona',
    ob_how_1_title: 'Registra en segundos',
    ob_how_1_text: 'Monto, comercio y listo. La categoría puede esperar.',
    ob_how_2_title: 'El desglose se arma solo',
    ob_how_2_text: 'A medida que clasificas, el mes se explica a sí mismo.',
    ob_how_3_title: 'Tus datos son tuyos',
    ob_how_3_text: 'Aislados por usuario, exportables cuando quieras. Moneda base:',
    ob_finish: 'Entrar a Reasonny',
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
    daily_average: 'Promedio diario',
    breakdown_empty: 'Sin gastos registrados en este periodo',
    breakdown_empty_hint: 'Tus gastos categorizados aparecerán aquí automáticamente',
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
    transaction_updated_success: 'Transaction updated successfully',
    validation_amount_positive: 'Amount must be greater than 0.',
    validation_merchant_required: 'Merchant name is required.',
    no_categories_available: 'No categories available',
    no_accounts_available: 'Main Account (Default)',
    account_cash: 'Cash',

    // Dashboard
    hero_total_balance: 'Total available balance',
    hero_realtime: 'Updated in real time',
    hero_new_expense: 'New expense',
    hero_hide_balance: 'Hide balance',
    hero_show_balance: 'Show balance',
    hero_hide_short: 'Hide',
    hero_show_short: 'Show',
    greeting: 'Hi',
    month_summary: 'Summary for',
    balance_available: 'Available balance',
    stat_expenses: 'Spending',
    stat_income: 'Income',
    stat_movements: 'Records',
    stat_records_short: 'rec.',
    action_record_expense: 'Record expense',
    action_record_income: 'Income',
    nav_export: 'Export CSV',
    nav_main: 'Main navigation',
    nav_notifications: 'Notifications',
    nav_profile: 'Profile',

    // Profile
    profile_title: 'Your profile',
    profile_name_label: 'What should we call you?',
    profile_name_placeholder: 'Your name',
    profile_name_hint: 'The name the app greets you by. Leave it empty and we use your email.',
    profile_save: 'Save',
    profile_saving: 'Saving…',
    profile_saved: 'Saved.',
    profile_email: 'Email',
    profile_currency: 'Base currency',
    profile_timezone: 'Time zone',

    // Detail and editing
    edit_title: 'Edit transaction',
    delete_transaction: 'Delete this transaction',
    delete_confirm: 'Delete this transaction? It will stop counting in your totals.',
    delete_confirm_yes: 'Yes, delete',

    // Review queue
    review_title: 'To review',
    review_lede: 'Tap a category to file it. Every one you assign sharpens the month breakdown.',
    review_open_detail: 'Open detail',
    review_clear_title: 'All caught up',
    review_clear_text: 'Nothing is waiting for a category.',
    review_back_home: 'Back to home',

    // Month
    month_nav: 'Change month',
    month_previous: 'Previous month',
    month_next: 'Next month',
    month_view: 'View the month',

    // Onboarding
    ob_welcome_title: 'Reason and money, in one place.',
    ob_welcome_text: 'Reasonny records what you spend with almost no effort and tells you what matters, without you going to look for it.',
    ob_start: 'Get started',
    ob_skip: 'Skip the intro',
    ob_skip_step: 'Not now',
    ob_continue: 'Continue',
    ob_name_title: 'What should we call you?',
    ob_name_text: 'Only to greet you. You can change it any time from your profile.',
    ob_how_title: 'How it works',
    ob_how_1_title: 'Record in seconds',
    ob_how_1_text: 'Amount, merchant, done. The category can wait.',
    ob_how_2_title: 'The breakdown builds itself',
    ob_how_2_text: 'As you file things, the month starts explaining itself.',
    ob_how_3_title: 'Your data is yours',
    ob_how_3_text: 'Isolated per user, exportable whenever. Base currency:',
    ob_finish: 'Enter Reasonny',
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
    daily_average: 'Daily average',
    breakdown_empty: 'No spending recorded for this period',
    breakdown_empty_hint: 'Your categorized expenses will appear here automatically',
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

/**
 * WHY timeZone IS A SEPARATE, REQUIRED ARGUMENT
 * --------------------------------------------
 * It used to be one optional field inside `options`, and every caller omitted
 * it. Intl then falls back to the HOST's zone, which on a Server Component
 * render is the server's - UTC on Vercel. So the totals grouped by the user's
 * timezone in SQL (CLAUDE.md rule 4) while the rows beside them were labelled
 * in UTC, and a spend on 31 August at 20:18 in Bogotá appeared as "1 sept"
 * inside the August view. The same date, disagreeing with itself on one screen.
 *
 * Pulling it out of the bag makes it a type error to forget. Rule 4 says every
 * aggregation carries the timezone; a date the user reads is the same promise,
 * and an optional field is not a promise.
 */
export function formatDate(
  date: Date | string | number,
  timeZone: string,
  locale: Locale = DEFAULT_LOCALE,
  options?: Intl.DateTimeFormatOptions,
): string {
  // new Date() accepts a Date as well as a string or a number, so no branch.
  const d = new Date(date);
  const localeTag = locale === 'es' ? 'es-CO' : 'en-US';
  return new Intl.DateTimeFormat(localeTag, {
    ...(options ?? {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }),
    timeZone,
  }).format(d);
}
