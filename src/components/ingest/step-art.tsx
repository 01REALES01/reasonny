import React from 'react';

/**
 * A drawing of the iPhone screen the current step is talking about.
 *
 * ONLY WHERE THERE IS NO CAPTURE
 * ------------------------------
 * A step with a real screenshot shows that instead (see step-shots.tsx). This
 * is for the steps a screenshot cannot serve well, rendered in whichever
 * language the steps are being read.
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
 * Drawings for the steps that have no capture in step-shots.tsx, keyed by the
 * step's id and the language being read.
 *
 * Only the first step is left: opening Shortcuts from the home-screen search
 * is not a screen of the app, and a capture of someone's home screen would
 * show their apps rather than the one to open. Every other step has a real
 * picture now, and a drawing kept "just in case" for each would be twenty
 * schematics nobody sees and nobody updates.
 */
export const STEP_ART: Readonly<Record<'es' | 'en', Readonly<Partial<Record<string, StepArt>>>>> = {
  es: {
    open: {
      title: 'Buscar',
      rows: [
        { label: 'atajos', field: true },
        { label: 'Atajos', value: 'App', target: true },
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
  },
};
