import Image from 'next/image';
import React from 'react';

/**
 * A real capture of the iPhone screen a step is talking about.
 *
 * WHY SCREENSHOTS NOW, WHEN THE MOCKS WERE CHOSEN AGAINST THEM
 * ------------------------------------------------------------
 * The drawings in step-art.tsx answer "which row do I tap" well, but the first
 * real users got lost on exactly the things a schematic cannot show: the grey
 * "Create New Shortcut" tile, and the variable bar that iOS puts ABOVE the
 * keyboard - people typed "Shortcut Input" as text because nothing told them
 * the answer was a bubble sitting over the letters. A picture of the actual
 * screen settles both at a glance.
 *
 * The objections to screenshots still hold, so they are handled rather than
 * ignored:
 * - Language: the captures come from an English iPhone and are shown to both
 *   languages. Where a thing sits on the screen does not change with the
 *   phone's language, the lit mark says what to tap, and the step's text gives
 *   the label in the reader's language. A Spanish set can replace these later
 *   without touching anything but this table.
 * - Weight: each file is a cropped 600px WebP of ~15 KB, lazy by default.
 * - Staleness: the marks are drawn over the image in CSS, so moving one after
 *   an iOS change is a number, not a new edit of the picture.
 *
 * NO CAPTURE MAY SHOW A TOKEN. The Authorization header on the real screen
 * carries a key that writes to someone's account, and the repo is treated as
 * public. Paint the value over before the file ever lands in /public.
 */

/** The thing to tap, as percentages of the image: left, top, width, height. */
export type ShotMark = readonly [number, number, number, number];

export interface StepShot {
  /** Under /public. Exactly the pixel size below, so the box never shifts. */
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly alt: Readonly<Record<'es' | 'en', string>>;
  /** Usually one. Two when the step asks for two taps on the same screen. */
  readonly marks: readonly ShotMark[];
}

export function StepScreenshot({
  shot,
  locale,
}: {
  readonly shot: StepShot;
  readonly locale: 'es' | 'en';
}): React.ReactElement {
  return (
    <figure className="shot">
      <Image
        src={shot.src}
        width={shot.width}
        height={shot.height}
        alt={shot.alt[locale]}
        sizes="(max-width: 560px) calc(100vw - 48px), 480px"
        className="shot-img"
      />
      {shot.marks.map(([left, top, width, height]) => (
        <span
          key={`${left}-${top}`}
          className="shot-mark"
          style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
          aria-hidden="true"
        />
      ))}
    </figure>
  );
}

/** Same screen, different question: the trigger options are one capture. */
const WHEN_SCREEN = {
  src: '/tutorial/when.webp',
  width: 600,
  height: 622,
} as const;

/**
 * Captures by step id. A missing entry is expected - it means "use the
 * drawing" - which is why this is Partial and step-art.tsx is not.
 */
export const STEP_SHOTS: Readonly<Partial<Record<string, StepShot>>> = {
  automation: {
    src: '/tutorial/automation.webp',
    width: 600,
    height: 734,
    alt: {
      es: 'La app Atajos, con la pestaña Automatización marcada en la barra de abajo',
      en: 'The Shortcuts app, with the Automation tab marked in the bottom bar',
    },
    marks: [[40.8, 83.9, 19, 11.7]],
  },
  plus: {
    src: '/tutorial/plus.webp',
    width: 600,
    height: 534,
    alt: {
      es: 'La lista de automatizaciones, con el botón + marcado arriba a la derecha',
      en: 'The automation list, with the + button marked at the top right',
    },
    marks: [[84.2, 0.9, 12.5, 13.7]],
  },
  trigger: {
    src: '/tutorial/trigger.webp',
    width: 600,
    height: 690,
    alt: {
      es: 'La lista de disparadores, con Mensaje marcado',
      en: 'The list of triggers, with Message marked',
    },
    marks: [[4.1, 49.8, 91.8, 13.3]],
  },
  contains: {
    ...WHEN_SCREEN,
    alt: {
      es: 'Las opciones del disparador, con Mensaje contiene marcado',
      en: 'The trigger options, with Message Contains marked',
    },
    marks: [[4.1, 49.2, 91.8, 12.5]],
  },
  immediate: {
    ...WHEN_SCREEN,
    alt: {
      es: 'Las opciones del disparador, con Ejecutar inmediatamente y Siguiente marcados',
      en: 'The trigger options, with Run Immediately and Next marked',
    },
    marks: [
      [4.1, 82.9, 91.8, 12],
      [78.5, 1.7, 17.8, 11.1],
    ],
  },
  blank: {
    src: '/tutorial/blank.webp',
    width: 600,
    height: 657,
    alt: {
      es: 'La pantalla de la automatización, con el recuadro gris Crear atajo nuevo marcado',
      en: 'The automation screen, with the grey Create New Shortcut tile marked',
    },
    marks: [[3, 60, 44, 27]],
  },
  location: {
    src: '/tutorial/search_location.webp',
    width: 600,
    height: 758,
    alt: {
      es: 'Un atajo vacío, con el buscador de acciones marcado abajo',
      en: 'An empty shortcut, with the action search marked at the bottom',
    },
    marks: [[6.3, 76.2, 87.4, 9]],
  },
  action: {
    src: '/tutorial/search_url.webp',
    width: 600,
    height: 908,
    alt: {
      es: 'El atajo con Obtener ubicación actual, y el buscador de acciones marcado',
      en: 'The shortcut with Get Current Location, and the action search marked',
    },
    marks: [[8.2, 85.1, 83.6, 7.5]],
  },
  url: {
    src: '/tutorial/url.webp',
    width: 600,
    height: 735,
    alt: {
      es: 'La acción Obtener contenido, con el campo URL marcado',
      en: 'The Get Contents action, with the URL field marked',
    },
    marks: [[51.7, 48.6, 14.8, 7.6]],
  },
  method: {
    src: '/tutorial/method.webp',
    width: 600,
    height: 638,
    alt: {
      es: 'La acción desplegada, con Método en POST marcado',
      en: 'The expanded action, with Method set to POST marked',
    },
    marks: [[4.1, 55.8, 91.8, 10.8]],
  },
  header: {
    src: '/tutorial/header.webp',
    width: 600,
    height: 667,
    alt: {
      es: 'Encabezados abierto, con Añadir encabezado nuevo marcado',
      en: 'Headers expanded, with Add new header marked',
    },
    marks: [[4.2, 70.7, 92, 9.8]],
  },
  token: {
    src: '/tutorial/token.webp',
    width: 600,
    height: 645,
    alt: {
      es: 'El encabezado Authorization con la llave tapada',
      en: 'The Authorization header, with the key hidden',
    },
    marks: [[4.1, 67, 91.8, 10]],
  },
  body_field: {
    src: '/tutorial/field_type.webp',
    width: 600,
    height: 659,
    alt: {
      es: 'El menú del tipo de campo, con Texto marcado',
      en: 'The field type menu, with Text marked',
    },
    marks: [[19.7, 48.3, 57.6, 9.9]],
  },
  body_text: {
    src: '/tutorial/shortcut_input.webp',
    width: 600,
    height: 652,
    alt: {
      es: 'La barra encima del teclado, con la burbuja Entrada del atajo marcada',
      en: 'The bar above the keyboard, with the Shortcut Input bubble marked',
    },
    marks: [[40.8, 55.9, 41, 10.6]],
  },
  location_fields: {
    src: '/tutorial/current_location.webp',
    width: 600,
    height: 765,
    alt: {
      es: 'Los campos latitude y longitude, con Ubicación actual marcada encima del teclado',
      en: 'The latitude and longitude fields, with Current Location marked above the keyboard',
    },
    marks: [[33.2, 62.4, 48.5, 9]],
  },
  location_bubbles: {
    src: '/tutorial/bubbles.webp',
    width: 600,
    height: 591,
    alt: {
      es: 'Las dos burbujas Ubicación actual marcadas',
      en: 'The two Current Location bubbles marked',
    },
    marks: [[43.2, 56.9, 33.1, 17.9]],
  },
  location_detail: {
    src: '/tutorial/lat_long.webp',
    width: 600,
    height: 915,
    alt: {
      es: 'El panel de Ubicación actual, con Latitud y Longitud marcadas',
      en: 'The Current Location panel, with Latitude and Longitude marked',
    },
    marks: [[5.8, 79.7, 88.5, 16.5]],
  },
  save_shortcut: {
    src: '/tutorial/done.webp',
    width: 600,
    height: 1166,
    alt: {
      es: 'El atajo terminado, con el botón ▶ marcado abajo y el ✓ azul arriba a la derecha',
      en: 'The finished shortcut, with the ▶ button marked at the bottom and the blue ✓ at the top right',
    },
    marks: [
      [79.9, 93.1, 9.2, 5.3],
      [84.5, 0.6, 12, 6.2],
    ],
  },
};
