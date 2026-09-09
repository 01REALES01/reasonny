import React from 'react';

/**
 * A drawing of the iPhone screen the current step is talking about.
 *
 * WHY A MOCK AND NOT A SCREENSHOT
 * -------------------------------
 * Real screenshots would be nine image files that go stale the moment Apple
 * reshuffles a menu, weigh far more than the screen they illustrate, and only
 * exist in one language - the reader with an English phone would be handed
 * pictures of a Spanish one, which is the exact confusion the language toggle
 * was added to fix. These are built from the same data in whichever language
 * the steps are being read, cost no bytes over the HTML, and stay legible when
 * the reader zooms.
 *
 * They are deliberately schematic. The job is not to look like iOS, it is to
 * answer "which of these things do I tap", so the target row is the only lit
 * thing on the screen and everything else is grey furniture.
 */
export interface ArtRow {
  readonly label: string;
  readonly value?: string;
  /** The thing to tap. Exactly one row per screen should carry it. */
  readonly target?: boolean;
  /** Draws an iOS switch instead of a value. */
  readonly toggle?: boolean;
  /** Draws the row as a text field with the label as its content. */
  readonly field?: boolean;
}

export interface StepArt {
  /** The screen's own title, as the phone shows it. */
  readonly title: string;
  readonly rows: readonly ArtRow[];
  /** Bottom tab bar. The tab to tap is the one marked with a leading `*`. */
  readonly tabs?: readonly string[];
  /** Draws a + in the top right, and lights it when it is the target. */
  readonly plus?: 'idle' | 'target';
}

export function StepArtwork({ art }: { readonly art: StepArt }): React.ReactElement {
  return (
    <div className="art" role="img" aria-label={art.title}>
      <div className="art-bar">
        <span className="art-chevron" aria-hidden="true">
          ‹
        </span>
        <span className="art-title">{art.title}</span>
        {art.plus && (
          <span
            className={`art-plus${art.plus === 'target' ? ' art-plus--target' : ''}`}
            aria-hidden="true"
          >
            +
          </span>
        )}
      </div>

      <div className="art-rows">
        {art.rows.map((row, i) => (
          <div
            // The list is a fixed literal per step, never reordered or filtered,
            // so the index is a stable identity here.
            key={i}
            className={[
              'art-row',
              row.target ? 'art-row--target' : '',
              row.field ? 'art-row--field' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <span className="art-label">{row.label}</span>
            {row.toggle ? (
              <span
                className={`art-switch${row.target ? ' art-switch--on' : ''}`}
                aria-hidden="true"
              />
            ) : (
              row.value && <span className="art-value">{row.value}</span>
            )}
          </div>
        ))}
      </div>

      {art.tabs && (
        <div className="art-tabs">
          {art.tabs.map((tab) => {
            const isTarget = tab.startsWith('*');
            return (
              <span
                key={tab}
                className={`art-tab${isTarget ? ' art-tab--target' : ''}`}
              >
                {isTarget ? tab.slice(1) : tab}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * One drawing per step, keyed by the step's id and the language being read.
 *
 * Kept out of the step objects themselves so the wizard's copy stays readable:
 * the instructions are the thing a person edits, and burying a screen mock in
 * the middle of each one would bury them.
 */
export const STEP_ART: Readonly<Record<'es' | 'en', Readonly<Record<string, StepArt>>>> = {
  es: {
    open: {
      title: 'Buscar',
      rows: [
        { label: 'atajos', field: true },
        { label: 'Atajos', value: 'App', target: true },
      ],
    },
    automation: {
      title: 'Atajos',
      rows: [{ label: 'Todos los atajos', value: '3' }],
      tabs: ['Atajos', '*Automatización'],
      plus: 'target',
    },
    trigger: {
      title: 'Nueva automatización',
      rows: [
        { label: 'Hora del día' },
        { label: 'Alarma' },
        { label: 'Mensaje', target: true },
        { label: 'Correo' },
      ],
    },
    sender: {
      title: 'Mensaje',
      rows: [
        { label: 'Remitente', value: '85888', target: true },
        { label: 'Mensaje contiene', value: 'Bancolombia' },
      ],
    },
    immediate: {
      title: 'Mensaje',
      rows: [
        { label: 'Ejecutar inmediatamente', toggle: true, target: true },
        { label: 'Ejecutar después de confirmar', toggle: true },
        { label: 'Notificar al ejecutar', toggle: true },
      ],
    },
    action: {
      title: 'Acciones',
      rows: [
        { label: 'obtener contenido', field: true },
        { label: 'Obtener contenido de la URL', target: true },
      ],
    },
    method: {
      title: 'Obtener contenido de la URL',
      rows: [
        { label: 'URL', value: 'reasonny.vercel.app…' },
        { label: 'Método', value: 'POST', target: true },
        { label: 'Encabezados' },
        { label: 'Cuerpo de la petición', value: 'JSON' },
      ],
    },
    header: {
      title: 'Encabezados',
      rows: [
        { label: 'Clave', value: 'Authorization', target: true },
        { label: 'Valor', value: 'Bearer …' },
      ],
    },
    body: {
      title: 'Cuerpo de la petición',
      rows: [
        { label: 'Tipo', value: 'JSON' },
        { label: 'Añadir campo nuevo', target: true },
        { label: 'text', value: 'Contenido del mensaje' },
      ],
    },
  },
  en: {
    open: {
      title: 'Search',
      rows: [
        { label: 'shortcuts', field: true },
        { label: 'Shortcuts', value: 'App', target: true },
      ],
    },
    automation: {
      title: 'Shortcuts',
      rows: [{ label: 'All Shortcuts', value: '3' }],
      tabs: ['Shortcuts', '*Automation'],
      plus: 'target',
    },
    trigger: {
      title: 'New Automation',
      rows: [
        { label: 'Time of Day' },
        { label: 'Alarm' },
        { label: 'Message', target: true },
        { label: 'Email' },
      ],
    },
    sender: {
      title: 'Message',
      rows: [
        { label: 'Sender', value: '85888', target: true },
        { label: 'Message Contains', value: 'Bancolombia' },
      ],
    },
    immediate: {
      title: 'Message',
      rows: [
        { label: 'Run Immediately', toggle: true, target: true },
        { label: 'Run After Confirmation', toggle: true },
        { label: 'Notify When Run', toggle: true },
      ],
    },
    action: {
      title: 'Actions',
      rows: [
        { label: 'get contents', field: true },
        { label: 'Get Contents of URL', target: true },
      ],
    },
    method: {
      title: 'Get Contents of URL',
      rows: [
        { label: 'URL', value: 'reasonny.vercel.app…' },
        { label: 'Method', value: 'POST', target: true },
        { label: 'Headers' },
        { label: 'Request Body', value: 'JSON' },
      ],
    },
    header: {
      title: 'Headers',
      rows: [
        { label: 'Key', value: 'Authorization', target: true },
        { label: 'Value', value: 'Bearer …' },
      ],
    },
    body: {
      title: 'Request Body',
      rows: [
        { label: 'Type', value: 'JSON' },
        { label: 'Add new field', target: true },
        { label: 'text', value: 'Message Content' },
      ],
    },
  },
};
