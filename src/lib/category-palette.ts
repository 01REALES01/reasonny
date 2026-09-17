/**
 * The colours a category can be given, in one place.
 *
 * WHY A HEX IS WHAT GETS STORED
 * -----------------------------
 * The drawer used to persist the CSS expression itself - `var(--cat-color-rose)`
 * - and that failed twice over. It is 24-28 characters against a
 * `varchar(20)` column, so every insert died with a raw Postgres error; and a
 * `var()` only means something inside this one stylesheet. The same row has to
 * be readable by the CSV export, the Telegram client and anything else that
 * never loads globals.css, so the column holds a plain `#rrggbb` - which is
 * also exactly what the seeded categories have always stored.
 *
 * `cssVar` is what paints the UI, so a component still names no colour of its
 * own (DESIGN_SYSTEM: no colour literals in src/components/). `hex` MUST equal
 * the value of that variable in globals.css; they are two spellings of one
 * decision, and the swatch is where a drift would show up first.
 */
export interface CategoryColor {
  readonly id: string;
  readonly label: string;
  /** Persisted. Portable to any client. */
  readonly hex: string;
  /** Rendered. Mirrors `hex`, defined in globals.css. */
  readonly cssVar: string;
}

export const CATEGORY_PALETTE: readonly CategoryColor[] = [
  { id: 'rose', label: 'Rosa', hex: '#f07aac', cssVar: 'var(--cat-color-rose)' },
  { id: 'champagne', label: 'Champagne', hex: '#e4cca6', cssVar: 'var(--cat-color-champagne)' },
  { id: 'emerald', label: 'Esmeralda', hex: '#10b981', cssVar: 'var(--cat-color-emerald)' },
  { id: 'amber', label: 'Ámbar', hex: '#f59e0b', cssVar: 'var(--cat-color-amber)' },
  { id: 'blue', label: 'Azul', hex: '#3b82f6', cssVar: 'var(--cat-color-blue)' },
  { id: 'purple', label: 'Púrpura', hex: '#a855f7', cssVar: 'var(--cat-color-purple)' },
  { id: 'cyan', label: 'Cian', hex: '#06b6d4', cssVar: 'var(--cat-color-cyan)' },
  { id: 'coral', label: 'Coral', hex: '#fb7185', cssVar: 'var(--cat-color-coral)' },
];

export const DEFAULT_CATEGORY_COLOR = '#e4cca6';

/**
 * What the column accepts. Anything longer than this cannot physically fit in
 * `categories.color`, so validating against it is what keeps a presentation
 * decision from reaching the database as a 500.
 */
export const CATEGORY_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
