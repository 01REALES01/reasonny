'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';

import { AnimatedCheck } from '@/components/ui/animated-check';
import { CategoryIcon } from '@/components/ui/category-icon';
import { STEP_ART, StepArtwork } from './step-art';
import { STEP_SHOTS, StepScreenshot } from './step-shots';

type Ui = 'es' | 'en';

interface IngestSetupProps {
  readonly token: string;
  readonly endpoint: string;
  /** Transactions the SMS automation has actually delivered, ever. */
  readonly receivedCount: number;
  /** ISO instant of the most recent arrival, or null if none. */
  readonly lastReceivedAt: string | null;
}

/**
 * "hace 4 minutos", from an instant.
 *
 * Intl.RelativeTimeFormat rather than a hand-rolled ladder of ifs, per the
 * design rule that no date is assembled by concatenation - it gets the plural
 * and the preposition right in both of the app's languages for free.
 *
 * Exported for its test. `now` is a parameter so the test does not have to
 * fake the clock.
 */
export function formatSince(iso: string, now: Date, locale: Ui = 'es'): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const seconds = Math.round((then - now.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  const units: readonly (readonly [Intl.RelativeTimeFormatUnit, number])[] = [
    ['second', 60],
    ['minute', 60],
    ['hour', 24],
    ['day', 30],
    ['month', 12],
  ];

  let value = seconds;
  for (const [unit, step] of units) {
    if (Math.abs(value) < step) return rtf.format(value, unit);
    value = Math.trunc(value / step);
  }
  return rtf.format(value, 'year');
}

interface Step {
  readonly id: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly body: React.ReactNode;
  /** Which secret, if any, this step needs on screen. */
  readonly copy?: 'url' | 'token';
  readonly cta: string;
}

const STORAGE_KEY = 'reasonny.ingest.progress';
const LOCALE_KEY = 'reasonny.ingest.locale';
const EXIT_MS = 200;

interface ScreenCopy {
  readonly badge: string;
  readonly hook: React.ReactNode;
  /** Takes the step count so the number cannot drift from the array again. */
  readonly lede: (steps: number) => string;
  readonly start: string;
  readonly stepCount: (current: number, total: number) => string;
  readonly copyIdle: string;
  readonly copyDone: string;
  readonly tokenWarning: string;
  readonly backLabel: string;
  readonly restart: string;
  readonly liveHook: React.ReactNode;
  readonly liveLede: (count: number, since: string | null) => string;
  readonly waitingHook: React.ReactNode;
  readonly waitingLede: React.ReactNode;
  readonly completeTitle: string;
  readonly completeSubtitle: string;
  readonly completeNote: string;
  readonly finishCta: string;
  readonly languageLabel: string;
}

const COPY: Readonly<Record<Ui, ScreenCopy>> = {
  es: {
    badge: 'Guardado automático',
    hook: (
      <>
        Que tus gastos se guarden <strong>solos</strong>.
      </>
    ),
    lede: (steps) =>
      `Cuando te llegue el SMS del banco, la transacción entra sola. Son ${steps} pasos cortos en tu iPhone y se hace una sola vez.`,
    start: 'Empezar',
    stepCount: (current, total) => `Paso ${current} de ${total}`,
    copyIdle: 'Copiar',
    copyDone: 'Copiado',
    tokenWarning:
      'Esto escribe transacciones en tu cuenta. No lo pegues en un chat ni lo muestres en una captura.',
    backLabel: 'Volver al paso anterior',
    restart: 'Volver a ver los pasos',
    liveHook: (
      <>
        Está <strong>funcionando</strong>.
      </>
    ),
    liveLede: (count, since) =>
      (count === 1
        ? 'Ha entrado 1 pago solo, sin que hicieras nada.'
        : `Han entrado ${count} pagos solos, sin que hicieras nada.`) +
      (since ? ` El último, ${since}.` : ''),
    waitingHook: (
      <>
        Falta <strong>la prueba</strong>.
      </>
    ),
    waitingLede: (
      <>
        Los pasos están hechos, pero todavía no ha llegado ningún SMS. Haz una
        compra o una transferencia pequeña y vuelve a esta pantalla: si la
        automatización quedó bien, aquí va a decir que está funcionando.
      </>
    ),
    completeTitle: 'Configuración lista',
    completeSubtitle: 'Tus gastos ahora se guardarán solos con ubicación y todo.',
    completeNote:
      'P.D.: Cuando hagas tu próxima compra con tu tarjeta, abre Reasonny para ver la magia en vivo.',
    finishCta: 'Finalizar',
    languageLabel: 'Idioma de los pasos',
  },
  en: {
    badge: 'Automatic capture',
    hook: (
      <>
        Let your spending record <strong>itself</strong>.
      </>
    ),
    lede: (steps) =>
      `When your bank texts you, the transaction lands on its own. ${steps} short steps on your iPhone, once.`,
    start: 'Start',
    stepCount: (current, total) => `Step ${current} of ${total}`,
    copyIdle: 'Copy',
    copyDone: 'Copied',
    tokenWarning:
      'This writes transactions to your account. Do not paste it into a chat or show it in a screenshot.',
    backLabel: 'Back to the previous step',
    restart: 'See the steps again',
    liveHook: (
      <>
        It is <strong>working</strong>.
      </>
    ),
    liveLede: (count, since) =>
      (count === 1
        ? '1 payment has come in on its own, with nothing from you.'
        : `${count} payments have come in on their own, with nothing from you.`) +
      (since ? ` The last one ${since}.` : ''),
    waitingHook: (
      <>
        Still <strong>unproven</strong>.
      </>
    ),
    waitingLede: (
      <>
        The steps are done, but no text message has arrived yet. Make a small
        purchase or transfer and come back to this screen: if the automation is
        set up right, this will say it is working.
      </>
    ),
    completeTitle: 'Setup Complete',
    completeSubtitle: 'Your expenses will now record on their own, complete with location.',
    completeNote:
      'P.S.: Next time you pay with your card, open Reasonny to see the magic happen live.',
    finishCta: 'Finish',
    languageLabel: 'Language of the steps',
  },
};

interface IngestCalloutProps {
  readonly icon: string;
  readonly children: React.ReactNode;
}

function IngestCallout({ icon, children }: IngestCalloutProps): React.ReactElement {
  return (
    <div className="ingest-callout">
      <span className="ingest-callout-icon" aria-hidden="true">
        <CategoryIcon name={icon} size={15} />
      </span>
      <span className="ingest-callout-text">{children}</span>
    </div>
  );
}

/**
 * "Paso 7", computed from the position rather than written into each step.
 *
 * The literals drifted the first time a step was inserted in the middle: every
 * number after it had to be edited by hand, in two languages, and one missed
 * edit shows two "Paso 7" in a row to someone already unsure they are on the
 * right screen.
 */
function withEyebrows(steps: readonly Omit<Step, 'eyebrow'>[], locale: Ui): Step[] {
  return steps.map((step, i) => ({
    ...step,
    eyebrow:
      i === steps.length - 1
        ? locale === 'en'
          ? 'Final step'
          : 'Último paso'
        : `${locale === 'en' ? 'Step' : 'Paso'} ${i + 1}`,
  }));
}

/**
 * One step per screen, and one screen per capture in step-shots.tsx.
 *
 * It used to be twelve steps, several of which asked for two or three things
 * on screens the reader had not seen yet ("add the field, name it, then pick
 * the variable"). The first users got lost exactly inside those: the grey tile
 * nobody mentioned, the variable bar above the keyboard, the capital letter
 * iOS puts on a key. A longer list of single taps is finished more often than
 * a shorter list of compound ones.
 */
export function buildSteps(locale: Ui): Step[] {
  if (locale === 'en') {
    return withEyebrows(
      [
        {
          id: 'open',
          title: 'Open the Shortcuts app',
          body: (
            <>
              It comes pre-installed on your iPhone. If you do not see it, swipe down on the home screen and search for <strong>Shortcuts</strong>.
            </>
          ),
          cta: 'It is open',
        },
        {
          id: 'automation',
          title: 'Tap «Automation», at the bottom',
          body: <>It is the middle tab of the bar at the bottom of the screen.</>,
          cta: 'Done',
        },
        {
          id: 'plus',
          title: 'Tap the + at the top right',
          body: <>It creates a new automation.</>,
          cta: 'Tapped',
        },
        {
          id: 'trigger',
          title: 'Choose «Message»',
          body: <>Scroll the list of triggers until you see it. It is the one that fires when a text arrives.</>,
          cta: 'Chosen',
        },
        {
          id: 'contains',
          title: 'In «Message Contains», type your bank',
          body: (
            <>
              Write <strong>Bancolombia</strong> or <strong>Banco de Bogotá</strong>, exactly as your bank signs its texts. Leave <em>Sender</em> as <em>Any Sender</em>.
              <IngestCallout icon="ShieldCheck">
                One automation per bank. If you use both, repeat these steps for the second one.
              </IngestCallout>
            </>
          ),
          cta: 'Bank typed',
        },
        {
          id: 'immediate',
          title: 'Tick «Run Immediately» and tap «Next»',
          body: (
            <>
              <strong>Run Immediately</strong> makes it run on its own, without asking you every time. Then tap <strong>Next</strong> at the top right.
            </>
          ),
          cta: 'Next tapped',
        },
        {
          id: 'blank',
          title: 'Tap the grey tile «Create New Shortcut»',
          body: (
            <>
              It sits under <em>Get Started</em>. Do not pick one of the shortcuts under <em>My Shortcuts</em>: this one has to start empty.
            </>
          ),
          cta: 'Tapped',
        },
        {
          id: 'location',
          title: 'Search for «Get Current Location»',
          body: (
            <>
              Type it in <strong>Search Actions</strong>, at the bottom, and tap it to add it.
              <IngestCallout icon="Sparkles">
                This lets Reasonny place each payment on the map.
              </IngestCallout>
            </>
          ),
          cta: 'Added',
        },
        {
          id: 'action',
          title: 'Search for «Get Contents of URL»',
          body: <>Same search box. Tap it, and it appears under the location.</>,
          cta: 'Added',
        },
        {
          id: 'url',
          title: 'Tap «URL» and paste this address',
          body: <>Copy it with the button below and paste it into the blue <em>URL</em> box.</>,
          copy: 'url',
          cta: 'Address pasted',
        },
        {
          id: 'method',
          title: 'Set «Method» to POST',
          body: (
            <>
              Tap the blue arrow next to the address to show the options, then change <em>Method</em> from GET to <strong>POST</strong>.
            </>
          ),
          cta: 'POST set',
        },
        {
          id: 'header',
          title: 'Open «Headers» and tap «Add new header»',
          body: (
            <>
              As the key, type <code>Authorization</code>.
            </>
          ),
          cta: 'Header added',
        },
        {
          id: 'token',
          title: 'Paste your key as the value',
          body: <>Copy it with the button below and paste it next to <em>Authorization</em>. It starts with <code>Bearer</code>; keep that word.</>,
          copy: 'token',
          cta: 'Key pasted',
        },
        {
          id: 'body_field',
          title: 'In «Request Body», add a Text field',
          body: (
            <>
              Check that <em>Request Body</em> says <strong>JSON</strong>, tap <strong>Add new field</strong> and choose <strong>Text</strong>. As the key, type <code>text</code>.
              <IngestCallout icon="AlertTriangle">
                In <strong>lowercase</strong>. The iPhone capitalises the first letter on its own: if you see <code>Text</code>, delete the T and type a lowercase one.
              </IngestCallout>
            </>
          ),
          cta: 'Field added',
        },
        {
          id: 'body_text',
          title: 'Tap the value and pick «Shortcut Input»',
          body: (
            <>
              When the keyboard opens, a bar appears <strong>right above the letters</strong>. <strong>Shortcut Input</strong> is in that bar: tap it there.
              <IngestCallout icon="Sparkles">
                Do not type it. It has to show up as a blue bubble; if it shows up as letters, it will not work.
              </IngestCallout>
            </>
          ),
          cta: 'Bubble set',
        },
        {
          id: 'location_fields',
          title: 'Add «latitude» and «longitude»',
          body: (
            <>
              Two more Text fields, keys <code>latitude</code> and <code>longitude</code>, in lowercase as well. In each value, pick <strong>Current Location</strong> from the bar above the keyboard.
            </>
          ),
          cta: 'Both added',
        },
        {
          id: 'location_bubbles',
          title: 'Tap each «Current Location» bubble',
          body: <>A panel opens to choose which part of the location goes in that field.</>,
          cta: 'Panel open',
        },
        {
          id: 'location_detail',
          title: 'Latitude in one, Longitude in the other',
          body: (
            <>
              In the <code>latitude</code> field choose <strong>Latitude</strong>; in <code>longitude</code>, <strong>Longitude</strong>.
            </>
          ),
          cta: 'Chosen',
        },
        {
          id: 'save_shortcut',
          title: 'Check it and tap the blue ✓',
          body: (
            <>
              It should look like this: location, address, <em>POST</em>, your key, and three fields in lowercase with blue bubbles. Then tap the <strong>✓</strong> at the top right.
              <IngestCallout icon="Check">
                From now on, every bank text records the spend on its own.
              </IngestCallout>
            </>
          ),
          cta: 'Saved',
        },
      ],
      locale,
    );
  }

  return withEyebrows(
    [
      {
        id: 'open',
        title: 'Abre la app Atajos',
        body: (
          <>
            Ya viene instalada en tu iPhone. Si no la ves, desliza hacia abajo en la pantalla de inicio y escribe <strong>Atajos</strong>.
          </>
        ),
        cta: 'La tengo abierta',
      },
      {
        id: 'automation',
        title: 'Toca «Automatización», abajo',
        body: <>Es la pestaña del centro, en la barra de abajo de la pantalla.</>,
        cta: 'Hecho',
      },
      {
        id: 'plus',
        title: 'Toca el + arriba a la derecha',
        body: <>Crea una automatización nueva.</>,
        cta: 'Tocado',
      },
      {
        id: 'trigger',
        title: 'Elige «Mensaje»',
        body: <>Baja por la lista de disparadores hasta verlo. Es el que se activa cuando te llega un SMS.</>,
        cta: 'Elegido',
      },
      {
        id: 'contains',
        title: 'En «Mensaje contiene», escribe tu banco',
        body: (
          <>
            Escribe <strong>Bancolombia</strong> o <strong>Banco de Bogotá</strong>, tal como tu banco firma sus mensajes. Deja <em>Remitente</em> en <em>Cualquier remitente</em>.
            <IngestCallout icon="ShieldCheck">
              Una automatización por banco. Si usas los dos, repite estos pasos para el segundo.
            </IngestCallout>
          </>
        ),
        cta: 'Banco escrito',
      },
      {
        id: 'immediate',
        title: 'Marca «Ejecutar inmediatamente» y toca «Siguiente»',
        body: (
          <>
            <strong>Ejecutar inmediatamente</strong> hace que corra solo, sin preguntarte cada vez. Luego toca <strong>Siguiente</strong> arriba a la derecha.
          </>
        ),
        cta: 'Siguiente tocado',
      },
      {
        id: 'blank',
        title: 'Toca el recuadro gris «Crear atajo nuevo»',
        body: (
          <>
            Está debajo de <em>Comenzar</em>. No elijas uno de <em>Mis atajos</em>: este tiene que empezar vacío.
          </>
        ),
        cta: 'Tocado',
      },
      {
        id: 'location',
        title: 'Busca «Obtener ubicación actual»',
        body: (
          <>
            Escríbela en <strong>Buscar acciones</strong>, abajo, y tócala para añadirla.
            <IngestCallout icon="Sparkles">
              Así Reasonny puede ubicar cada pago en el mapa.
            </IngestCallout>
          </>
        ),
        cta: 'Añadida',
      },
      {
        id: 'action',
        title: 'Busca «Obtener contenido de la URL»',
        body: <>En el mismo buscador. Tócala y aparece debajo de la ubicación.</>,
        cta: 'Añadida',
      },
      {
        id: 'url',
        title: 'Toca «URL» y pega esta dirección',
        body: <>Cópiala con el botón de abajo y pégala en el recuadro azul <em>URL</em>.</>,
        copy: 'url',
        cta: 'Dirección pegada',
      },
      {
        id: 'method',
        title: 'Pon «Método» en POST',
        body: (
          <>
            Toca la flecha azul junto a la dirección para ver las opciones y cambia <em>Método</em> de GET a <strong>POST</strong>.
          </>
        ),
        cta: 'POST puesto',
      },
      {
        id: 'header',
        title: 'Abre «Encabezados» y toca «Añadir encabezado nuevo»',
        body: (
          <>
            Como clave, escribe <code>Authorization</code>.
          </>
        ),
        cta: 'Encabezado añadido',
      },
      {
        id: 'token',
        title: 'Pega tu llave como valor',
        body: <>Cópiala con el botón de abajo y pégala junto a <em>Authorization</em>. Empieza por <code>Bearer</code>; deja esa palabra.</>,
        copy: 'token',
        cta: 'Llave pegada',
      },
      {
        id: 'body_field',
        title: 'En «Cuerpo de la petición», añade un campo de texto',
        body: (
          <>
            Revisa que <em>Cuerpo de la petición</em> diga <strong>JSON</strong>, toca <strong>Añadir campo nuevo</strong> y elige <strong>Texto</strong>. Como clave, escribe <code>text</code>.
            <IngestCallout icon="AlertTriangle">
              En <strong>minúscula</strong>. El iPhone pone la primera letra en mayúscula solo: si ves <code>Text</code>, borra la T y escríbela en minúscula.
            </IngestCallout>
          </>
        ),
        cta: 'Campo añadido',
      },
      {
        id: 'body_text',
        title: 'Toca el valor y elige «Entrada del atajo»',
        body: (
          <>
            Al abrirse el teclado aparece una barra <strong>justo encima de las letras</strong>. <strong>Entrada del atajo</strong> está en esa barra: tócala ahí.
            <IngestCallout icon="Sparkles">
              No lo escribas. Tiene que quedar como una burbuja azul; si queda como letras, no funciona.
            </IngestCallout>
          </>
        ),
        cta: 'Burbuja puesta',
      },
      {
        id: 'location_fields',
        title: 'Añade «latitude» y «longitude»',
        body: (
          <>
            Dos campos de texto más, con claves <code>latitude</code> y <code>longitude</code>, también en minúscula. En cada valor, elige <strong>Ubicación actual</strong> en la barra sobre el teclado.
          </>
        ),
        cta: 'Los dos añadidos',
      },
      {
        id: 'location_bubbles',
        title: 'Toca cada burbuja «Ubicación actual»',
        body: <>Se abre un panel para elegir qué parte de la ubicación va en ese campo.</>,
        cta: 'Panel abierto',
      },
      {
        id: 'location_detail',
        title: 'Latitud en uno, Longitud en el otro',
        body: (
          <>
            En el campo <code>latitude</code> elige <strong>Latitud</strong>; en <code>longitude</code>, <strong>Longitud</strong>.
          </>
        ),
        cta: 'Elegidas',
      },
      {
        id: 'save_shortcut',
        title: 'Revísalo y toca el ✓ azul',
        body: (
          <>
            Debe verse así: ubicación, dirección, <em>POST</em>, tu llave y tres campos en minúscula con burbujas azules. Luego toca el <strong>✓</strong> arriba a la derecha.
            <IngestCallout icon="Check">
              Desde ahora, cada SMS del banco registra el gasto solo.
            </IngestCallout>
          </>
        ),
        cta: 'Guardado',
      },
    ],
    locale,
  );
}

function SetupCompleteArt(): React.ReactElement {
  return (
    <div className="ingest-complete-art" aria-hidden="true">
      <svg
        viewBox="0 0 240 180"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="ingest-complete-svg"
      >
        <defs>
          <radialGradient
            id="portalGlow"
            cx="50%"
            cy="50%"
            r="50%"
            fx="50%"
            fy="50%"
          >
            <stop offset="0%" className="ingest-glow-stop-center" />
            <stop offset="45%" className="ingest-glow-stop-mid" />
            <stop offset="100%" className="ingest-glow-stop-end" />
          </radialGradient>
          <linearGradient
            id="doorLight"
            x1="120"
            y1="35"
            x2="120"
            y2="155"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" className="ingest-door-light-top" />
            <stop offset="100%" className="ingest-door-light-base" />
          </linearGradient>
        </defs>

        {/* Ambient opalescent luminescent glow */}
        <circle cx="120" cy="95" r="78" fill="url(#portalGlow)" />

        {/* Portal arch frame */}
        <path
          d="M75 155 V85 C75 60.147 95.147 40 120 40 C144.853 40 165 60.147 165 85 V155"
          className="ingest-portal-frame"
          strokeWidth="3"
        />

        {/* Doorway beam of light */}
        <path
          d="M80 155 V85 C80 62.909 97.909 45 120 45 C142.091 45 160 62.909 160 85 V155 Z"
          fill="url(#doorLight)"
        />

        {/* Illuminated threshold floor */}
        <ellipse cx="120" cy="155" rx="55" ry="12" className="ingest-portal-threshold" />

        {/* Mascot Hand in radiant portal */}
        <g className="ingest-mascot-hand">
          {/* Forearm / Wrist reaching into light */}
          <path
            d="M113 155 L114 137 C114 135 116 133 118 133 L122 133 C124 133 126 135 126 137 L127 155 Z"
            className="ingest-hand-fill"
          />
          {/* Friendly Hand: welcoming open palm with 5 rounded fingers */}
          <path
            d="M112 134
               C107 132 99 125 96 116
               C94 110 99 106 103 107
               C106 108 109 111 111 115
               L111 96
               C111 90 116 90 116 96
               L116 113
               L117 89
               C117 83 123 83 123 89
               L123 113
               L124 92
               C124 86 129 86 129 92
               L129 114
               L130 98
               C130 93 135 93 135 98
               C135 111 134 122 131 129
               C129 133 128 134 128 134 Z"
            className="ingest-hand-fill"
          />
          {/* Star sparkle in palm */}
          <path
            d="M121 118 L122.2 121.2 L125.5 122.2 L122.2 123.2 L121 126.5 L119.8 123.2 L116.5 122.2 L119.8 121.2 Z"
            className="ingest-hand-star"
          />
        </g>

        {/* Floating stars and luminescent sparkles */}
        <path
          d="M172 45 L173.5 50 L178.5 51.5 L173.5 53 L172 58 L170.5 53 L165.5 51.5 L170.5 50 Z"
          className="ingest-star"
        />
        <path
          d="M68 62 L69 66 L73 67 L69 68 L68 72 L67 68 L63 67 L67 66 Z"
          className="ingest-star"
        />
        <circle cx="180" cy="85" r="2" className="ingest-dot" />
        <circle cx="60" cy="100" r="1.5" className="ingest-dot" />
        <circle cx="120" cy="58" r="1.5" className="ingest-dot" />
      </svg>
    </div>
  );
}

function WelcomeTalisman(): React.ReactElement {
  return (
    <div className="ingest-welcome-talisman" aria-hidden="true">
      <svg
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="ingest-talisman-svg"
      >
        <defs>
          <radialGradient
            id="talismanAura"
            cx="50%"
            cy="50%"
            r="50%"
            fx="50%"
            fy="50%"
          >
            <stop offset="0%" className="ingest-glow-stop-center" />
            <stop offset="50%" className="ingest-glow-stop-mid" />
            <stop offset="100%" className="ingest-glow-stop-end" />
          </radialGradient>
          <linearGradient
            id="gemGradient"
            x1="30"
            y1="25"
            x2="90"
            y2="95"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" className="ingest-door-light-top" />
            <stop offset="60%" className="ingest-door-light-base" />
            <stop offset="100%" className="ingest-hand-star" />
          </linearGradient>
        </defs>

        {/* Ambient luminescent aura */}
        <circle cx="60" cy="60" r="54" fill="url(#talismanAura)" />

        {/* Outer orbital ring */}
        <circle
          cx="60"
          cy="60"
          r="44"
          stroke="var(--landing-champagne-gold)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          opacity="0.5"
        />

        {/* Organic luminescent talisman stone */}
        <path
          d="M60 26 C76 26 94 38 92 58 C90 78 74 94 58 92 C42 90 28 76 30 56 C32 36 44 26 60 26 Z"
          fill="url(#gemGradient)"
          stroke="var(--landing-champagne-gold)"
          strokeWidth="2"
        />

        {/* Mascot Hand inside luminescent talisman */}
        <g className="ingest-mascot-hand">
          <path
            d="M57 78 L57 70 C57 69 58 68 59 68 L61 68 C62 68 63 69 63 70 L63 78 Z"
            className="ingest-hand-fill"
          />
          <path
            d="M56 69
               C53 68 49 65 48 61
               C47 58 50 56 52 57
               C54 57 55 59 56 61
               L56 52
               C56 49 59 49 59 52
               L59 60
               L60 48
               C60 45 63 45 63 48
               L63 60
               L64 50
               C64 47 67 47 67 50
               L67 61
               L68 54
               C68 51 71 51 71 54
               C71 60 70 65 68 67
               C66 69 64 69 64 69 Z"
            className="ingest-hand-fill"
          />
          <path
            d="M60 62 L60.7 63.8 L62.5 64.5 L60.7 65.2 L60 67 L59.3 65.2 L57.5 64.5 L59.3 63.8 Z"
            className="ingest-hand-star"
          />
        </g>

        {/* Floating sparkles */}
        <path
          d="M88 34 L89 37 L92 38 L89 39 L88 42 L87 39 L84 38 L87 37 Z"
          className="ingest-star"
        />
        <path
          d="M32 42 L33 44 L35 45 L33 46 L32 48 L31 46 L29 45 L31 44 Z"
          className="ingest-star"
        />
      </svg>
    </div>
  );
}

function getStepLightVariant(stepIndex: number): 'left' | 'right' | 'dual' | 'zenith' {
  switch (stepIndex % 4) {
    case 0:
      return 'left';
    case 1:
      return 'right';
    case 2:
      return 'dual';
    case 3:
    default:
      return 'zenith';
  }
}



/**
 * Guided setup for the SMS automation.
 *
 * This was a list of eight numbered steps and nobody was going to finish it.
 * Eight instructions shown at once read as a wall: the reader has to hold their
 * place, and the cost of the whole thing is visible before any of it is done.
 *
 * One step at a time removes both. The bar shows progress without showing the
 * remaining work as a list, each step is confirmed rather than merely read, and
 * the progress survives a reload - abandoning at step six and starting again
 * from one is what makes people not start again.
 *
 * The token is never on screen until the step that needs it.
 */
export function IngestSetup({
  token,
  endpoint,
  receivedCount,
  lastReceivedAt,
}: IngestSetupProps): React.ReactElement {
  /**
   * Spanish until the browser says otherwise, then whatever the user picks.
   *
   * The default follows navigator.language rather than the app's locale on
   * purpose: what these steps describe is the Shortcuts app, whose menus are
   * labelled in the PHONE's language. Someone reading the app in Spanish on an
   * English iPhone needs the English instructions, and that is the common case
   * for a phone bought abroad.
   */
  const [ui, setUi] = useState<Ui>('es');
  const steps = buildSteps(ui);
  const copy = COPY[ui];
  const [index, setIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  // Lets the confirmed state be dismissed to reach the steps behind it. It is
  // not persisted: reopening the instructions is a one-off, and remembering the
  // choice would hide the confirmation the next time the page is opened.
  const [showSteps, setShowSteps] = useState(false);

  // Read after mount, never during render: the server has no localStorage, and
  // seeding state from it directly makes the first client render disagree with
  // the server's and React throws away the tree.
  useEffect(() => {
    try {
      const savedLocale = window.localStorage.getItem(LOCALE_KEY);
      if (savedLocale === 'en' || savedLocale === 'es') {
        setUi(savedLocale);
      } else if (navigator.language.toLowerCase().startsWith('en')) {
        setUi('en');
      }

      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        const parsed = Number(saved);
        if (Number.isInteger(parsed) && parsed > 0) {
          setIndex(Math.min(parsed, steps.length));
          setStarted(true);
        }
      }
    } catch {
      // Private windows and blocked site data. Starting from zero is fine.
    }
    setHydrated(true);
  }, [steps.length]);

  function chooseUi(next: Ui): void {
    setUi(next);
    try {
      window.localStorage.setItem(LOCALE_KEY, next);
    } catch {
      // Same as the progress: a convenience, not state the flow depends on.
    }
  }

  function persist(next: number): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // Progress is a convenience, not state the flow depends on.
    }
  }

  function advance(): void {
    setExiting(true);
    setCopied(false);
    window.setTimeout(() => {
      const next = index + 1;
      setIndex(next);
      persist(next);
      setExiting(false);
    }, EXIT_MS);
  }

  /**
   * A tap lands on the wrong thing all the time, and without a way back the
   * only recovery was starting the whole flow over. It is an arrow rather than
   * a labelled button on purpose: going back is a correction, not one of the
   * two things this screen is asking you to do.
   */
  function goBack(): void {
    if (index === 0) {
      return;
    }
    setCopied(false);
    const previous = index - 1;
    setIndex(previous);
    persist(previous);
  }

  function restart(): void {
    setIndex(0);
    setStarted(false);
    setShowSteps(true);
    persist(0);
  }

  async function copyValue(value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard is blocked outside a secure context. The value is on screen.
    }
  }

  const done = index >= steps.length;
  const progress = done ? 100 : Math.max(8, Math.round(((index + 1) / steps.length) * 100));

  let lightVariant: 'welcome' | 'left' | 'right' | 'dual' | 'zenith' | 'complete' = 'welcome';
  if (receivedCount > 0 && !showSteps) {
    lightVariant = 'complete';
  } else if (!started && index === 0) {
    lightVariant = 'welcome';
  } else if (done) {
    lightVariant = 'complete';
  } else {
    lightVariant = getStepLightVariant(index);
  }

  /**
   * A pair of pills, not a <select>: two options do not need a menu, and this
   * has to be readable by someone who cannot read the language it is currently
   * showing - which is exactly the person who needs it.
   */
  const languageToggle = (
    <div className="ingest-lang" role="group" aria-label={copy.languageLabel}>
      {(['es', 'en'] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => chooseUi(option)}
          className={`ingest-lang-pill${option === ui ? ' ingest-lang-pill--on' : ''}`}
          aria-pressed={option === ui}
        >
          {option === 'es' ? 'Español' : 'English'}
        </button>
      ))}
    </div>
  );

  const step = steps[index] ?? steps[0]!;
  const art = STEP_ART[ui][step.id];
  const shot = STEP_SHOTS[step.id];
  const secret = step.copy === 'url' ? endpoint : `Bearer ${token}`;

  return (
    <main className="ingest-fullscreen">
      <div
        key={`aurora-${index}-${started ? 'step' : 'welcome'}-${done ? 'done' : ''}`}
        className={`ingest-aurora ingest-aurora--${lightVariant}`}
        aria-hidden="true"
      />

      <div className="ingest-fullscreen-header">
        <Link href="/dashboard" className="ingest-fullscreen-back">
          <CategoryIcon name="ArrowLeft" size={15} />
          <span>Inicio</span>
        </Link>
        <Link
          href="/dashboard"
          className="ingest-fullscreen-close"
          aria-label="Cerrar"
        >
          <CategoryIcon name="X" size={17} />
        </Link>
      </div>

      <div className="ingest-fullscreen-body">
        {receivedCount > 0 && !showSteps ? (
          <section className="ingest ingest--done">
            <span className="ingest-trophy" aria-hidden="true">
              <CategoryIcon name="ShieldCheck" size={28} />
            </span>
            <h2 className="ingest-hook">{copy.liveHook}</h2>
            <p className="ingest-lede">
              {copy.liveLede(
                receivedCount,
                lastReceivedAt ? formatSince(lastReceivedAt, new Date(), ui) : null,
              )}
            </p>
            <button type="button" onClick={restart} className="ingest-restart">
              {copy.restart}
            </button>
          </section>
        ) : !started && index === 0 ? (
          <section className="ingest ingest--welcome">
            <div className="ingest-welcome-content">
              <WelcomeTalisman />

              <span className="ingest-badge">
                <CategoryIcon name="Nfc" size={13} />
                <span>{copy.badge}</span>
              </span>

              <h2 className="ingest-hook">{copy.hook}</h2>
              <p className="ingest-lede">{copy.lede(steps.length)}</p>
            </div>

            <div className="ingest-welcome-actions">
              {languageToggle}

              <button
                type="button"
                onClick={() => setStarted(true)}
                className="ingest-start"
              >
                <span>{copy.start}</span>
                <CategoryIcon name="ArrowRight" size={16} />
              </button>
            </div>
          </section>
        ) : done ? (
          <section className="ingest-complete-card">
            <div className="ingest-complete-body">
              <SetupCompleteArt />

              <h2 className="ingest-complete-title">{copy.completeTitle}</h2>
              <p className="ingest-complete-subtitle">{copy.completeSubtitle}</p>

              <div className="ingest-complete-note">
                <span className="ingest-complete-note-icon" aria-hidden="true">
                  <CategoryIcon name="Sparkles" size={15} />
                </span>
                <p className="ingest-complete-note-text">{copy.completeNote}</p>
              </div>
            </div>

            <div className="ingest-complete-actions">
              <Link href="/dashboard" className="ingest-finish-btn">
                <span>{copy.finishCta}</span>
                <CategoryIcon name="ArrowRight" size={16} />
              </Link>

              <button type="button" onClick={restart} className="ingest-restart">
                {copy.restart}
              </button>
            </div>
          </section>
        ) : (
          <section className="ingest">
            <div className="ingest-head">
              {index > 0 ? (
                <button
                  type="button"
                  onClick={goBack}
                  className="ingest-back"
                  aria-label={copy.backLabel}
                >
                  <CategoryIcon name="ArrowLeft" size={15} />
                </button>
              ) : (
                <span className="ingest-back ingest-back--placeholder" aria-hidden="true" />
              )}

              <span className="ingest-count">{copy.stepCount(index + 1, steps.length)}</span>
            </div>

            {/* scaleX rather than width: width is a layout property and animating it
                is what the design system forbids. */}
            <div
              className="ingest-track"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <span
                className="ingest-fill"
                style={{ transform: `scaleX(${progress / 100})` }}
              />
            </div>

            <div
              className={`ingest-step${exiting ? ' ingest-step--out' : ''}`}
              key={step.id}
            >
              <div className="ingest-step-main">
                <span className="ingest-eyebrow">{step.eyebrow}</span>
                <h2 className="ingest-title">{step.title}</h2>
                <div className="ingest-body">{step.body}</div>

                {shot ? <StepScreenshot shot={shot} locale={ui} /> : art && <StepArtwork art={art} />}

                {step.copy && (
                  <button
                    type="button"
                    onClick={() => copyValue(secret)}
                    className="ingest-secret"
                  >
                    <code>{secret}</code>
                    <span className="ingest-secret-action">
                      {copied ? (
                        <>
                          <AnimatedCheck size={14} />
                          <span>{copy.copyDone}</span>
                        </>
                      ) : (
                        copy.copyIdle
                      )}
                    </span>
                  </button>
                )}

                {step.copy === 'token' && (
                  <p className="ingest-warning">{copy.tokenWarning}</p>
                )}
              </div>

              <div className="ingest-step-footer">
                <button type="button" onClick={advance} className="ingest-start">
                  <span>{step.cta}</span>
                  <CategoryIcon name="ArrowRight" size={16} />
                </button>

                {languageToggle}
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
