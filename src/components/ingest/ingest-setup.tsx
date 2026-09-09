'use client';

import React, { useEffect, useState } from 'react';

import { CategoryIcon } from '@/components/ui/category-icon';

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
  /** Shown after the step is cleared. Varied on purpose - the same word eight times stops registering. */
  readonly cheer: string;
}

const STORAGE_KEY = 'reasonny.ingest.progress';
const LOCALE_KEY = 'reasonny.ingest.locale';
const EXIT_MS = 200;

/**
 * WHY THESE STRINGS ARE NOT IN THE TRANSLATION CATALOGUE
 * -----------------------------------------------------
 * The catalogue in lib/i18n.ts maps a key to a STRING, and these are not
 * strings: every step body carries markup that is load-bearing - the field name
 * the user has to find is bold, the literal they have to type is code. Flatten
 * that to text and the instruction stops being followable, which for a wizard
 * whose whole job is being followed is the wrong trade. They live here, beside
 * the only screen that renders them, in both languages.
 *
 * Both languages matter more here than anywhere else in the app: this screen
 * tells the user which buttons to tap in Apple's Shortcuts app, and those
 * buttons are named in the PHONE's language, not the app's. Someone with an
 * iPhone in English is hunting for "Automation" while being told to tap
 * «Automatización». The toggle is what makes the instructions usable at all.
 */
interface ScreenCopy {
  readonly badge: string;
  readonly hook: React.ReactNode;
  readonly lede: string;
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
    lede: 'Cuando te llegue el SMS del banco, la transacción entra sola. Son 8 pasos cortos en tu iPhone y se hace una sola vez.',
    start: 'Empezar',
    stepCount: (current, total) => `${current} de ${total}`,
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
    languageLabel: 'Idioma de los pasos',
  },
  en: {
    badge: 'Automatic capture',
    hook: (
      <>
        Let your spending record <strong>itself</strong>.
      </>
    ),
    lede: 'When your bank texts you, the transaction lands on its own. Eight short steps on your iPhone, once.',
    start: 'Start',
    stepCount: (current, total) => `${current} of ${total}`,
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
    languageLabel: 'Language of the steps',
  },
};

function buildSteps(locale: Ui): Step[] {
  if (locale === 'en') {
    return [
      {
        id: 'open',
        eyebrow: 'Let us start',
        title: 'Open the Shortcuts app',
        body: (
          <>
            It comes with your iPhone. If you cannot see it, swipe down on the
            home screen and type <strong>Shortcuts</strong>.
          </>
        ),
        cta: 'It is open',
        cheer: 'Off to a good start.',
      },
      {
        id: 'automation',
        eyebrow: 'Step 2',
        title: 'Tap «Automation», at the bottom',
        body: (
          <>
            It is the middle tab. Then tap the <strong>+</strong> at the top
            right.
          </>
        ),
        cta: 'Done',
        cheer: 'That was the hidden part.',
      },
      {
        id: 'trigger',
        eyebrow: 'Step 3',
        title: 'Find «Message» and choose it',
        body: <>In the list of triggers. It is the one that fires on an SMS.</>,
        cta: 'Chosen',
        cheer: 'That is the heart of it.',
      },
      {
        id: 'sender',
        eyebrow: 'Step 4',
        title: 'Use the sender, not the bank name',
        body: (
          <>
            Banks do not text from a name: they send from a{' '}
            <strong>five digit short code</strong>. Open Messages, go into your
            bank&apos;s conversation and copy that number from the top. Paste it
            into <em>Sender</em>.
            <br />
            <br />
            If you also put the bank&apos;s name in <em>Message contains</em>,
            the verification codes that same number sends never leave the phone.
          </>
        ),
        cta: 'Sender set',
        cheer: 'Now no message slips past.',
      },
      {
        id: 'immediate',
        eyebrow: 'Step 5',
        title: 'Tick «Run immediately»',
        body: (
          <>
            And if it lets you, turn off <strong>Notify when run</strong>. That
            makes the capture invisible: no banner on every payment.
          </>
        ),
        cta: 'Ticked',
        cheer: 'That makes it invisible.',
      },
      {
        id: 'action',
        eyebrow: 'Step 6',
        title: 'Add «Get contents of URL»',
        body: <>Search for it in the actions and paste this address:</>,
        copy: 'url',
        cta: 'URL pasted',
        cheer: 'Almost there. The technical bit is next.',
      },
      {
        id: 'method',
        eyebrow: 'Step 7',
        title: 'Expand «Show more» and set POST',
        body: (
          <>
            Change the method from <em>GET</em> to <strong>POST</strong>. It is
            right under the URL.
          </>
        ),
        cta: 'Changed',
        cheer: 'The hard half is behind you.',
      },
      {
        id: 'header',
        eyebrow: 'Step 8',
        title: 'Add the access header',
        body: (
          <>
            Under <em>Headers</em>, field <code>Authorization</code>. As the
            value, paste this exactly as it is, including the word «Bearer»:
          </>
        ),
        copy: 'token',
        cta: 'Header set',
        cheer: 'That is your key. Nobody else gets in.',
      },
      {
        id: 'body',
        eyebrow: 'Last step',
        title: 'Set up the request body',
        body: (
          <>
            Under <em>Request Body</em> choose <strong>JSON</strong>. Add a{' '}
            <strong>text</strong> field named <code>text</code> and, as its
            value, pick the <strong>Message Content</strong> variable. Save.
          </>
        ),
        cta: 'Saved',
        cheer: '',
      },
    ];
  }

  return [

    {
      id: 'open',
      eyebrow: 'Empecemos',
      title: 'Abre la app Atajos',
      body: (
        <>
          Ya viene instalada en tu iPhone. Si no la ves, desliza hacia abajo en
          la pantalla de inicio y escribe <strong>Atajos</strong>.
        </>
      ),
      cta: 'La tengo abierta',
      cheer: 'Vamos bien.',
    },
    {
      id: 'automation',
      eyebrow: 'Paso 2',
      title: 'Toca «Automatización», abajo',
      body: (
        <>
          Es la pestaña del centro. Luego toca el <strong>+</strong> arriba a la
          derecha.
        </>
      ),
      cta: 'Hecho',
      cheer: 'Esa era la parte escondida.',
    },
    {
      id: 'trigger',
      eyebrow: 'Paso 3',
      title: 'Busca «Mensaje» y elígelo',
      body: (
        <>
          En la lista de disparadores. Es el que se activa cuando te llega un
          SMS.
        </>
      ),
      cta: 'Elegido',
      cheer: 'Ese es el corazón de todo.',
    },
    {
      id: 'sender',
      eyebrow: 'Paso 4',
      title: 'Pon el remitente, no el nombre del banco',
      body: (
        <>
          Los bancos no escriben desde un nombre: mandan desde un{' '}
          <strong>número corto de 5 dígitos</strong>. Abre Mensajes, entra a la
          conversación de tu banco y copia ese número de arriba. Pégalo en{' '}
          <em>Remitente</em>.
          <br />
          <br />
          Si además escribes el nombre del banco en <em>Mensaje contiene</em>,
          los códigos de verificación que te manda ese mismo número nunca salen
          del teléfono.
        </>
      ),
      cta: 'Remitente puesto',
      cheer: 'Así no se te escapa ningún mensaje.',
    },
    {
      id: 'immediate',
      eyebrow: 'Paso 5',
      title: 'Marca «Ejecutar inmediatamente»',
      body: (
        <>
          Y si te deja, apaga <strong>Notificar al ejecutar</strong>. Con eso la
          captura es invisible: no te deja un aviso en cada pago.
        </>
      ),
      cta: 'Marcado',
      cheer: 'Con eso la captura es invisible.',
    },
    {
      id: 'action',
      eyebrow: 'Paso 6',
      title: 'Añade «Obtener contenido de la URL»',
      body: <>Búscala en las acciones y pega esta dirección:</>,
      copy: 'url',
      cta: 'URL pegada',
      cheer: 'Ya casi. Queda la parte técnica.',
    },
    {
      id: 'method',
      eyebrow: 'Paso 7',
      title: 'Despliega «Mostrar más» y pon POST',
      body: (
        <>
          Cambia el método de <em>GET</em> a <strong>POST</strong>. Está justo
          debajo de la URL.
        </>
      ),
      cta: 'Cambiado',
      cheer: 'La mitad difícil, superada.',
    },
    {
      id: 'header',
      eyebrow: 'Paso 8',
      title: 'Añade el encabezado de acceso',
      body: (
        <>
          En <em>Encabezados</em>, campo <code>Authorization</code>. Como valor,
          pega esto tal cual — incluida la palabra «Bearer»:
        </>
      ),
      copy: 'token',
      cta: 'Encabezado puesto',
      cheer: 'Eso es tu llave. Nadie más entra.',
    },
    {
      id: 'body',
      eyebrow: 'Último paso',
      title: 'Configura el cuerpo del mensaje',
      body: (
        <>
          En <em>Cuerpo de la petición</em> elige <strong>JSON</strong>. Añade un
          campo de <strong>texto</strong> llamado <code>text</code> y, como
          valor, selecciona la variable <strong>Contenido del mensaje</strong>.
          Guarda.
        </>
      ),
      cta: 'Guardado',
      cheer: '',
    },
  ];
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

  if (!hydrated) {
    return <section className="ingest" aria-busy="true" />;
  }

  const done = index >= steps.length;
  const progress = done ? 100 : Math.round((index / steps.length) * 100);

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

  /**
   * Proof beats progress.
   *
   * This comes before every other state on purpose, including the eight-step
   * wizard. If transactions have arrived, the automation is running - whether
   * or not this browser's localStorage remembers the taps that set it up, and
   * whether or not it was this phone that did. A user who reinstalled, or who
   * set it up months ago, should not be shown a pitch for something they
   * already have.
   */
  if (receivedCount > 0 && !showSteps) {
    return (
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
    );
  }

  if (!started && index === 0) {
    return (
      <section className="ingest">
        <span className="ingest-badge">
          <CategoryIcon name="Nfc" size={13} />
          <span>{copy.badge}</span>
        </span>

        <h2 className="ingest-hook">{copy.hook}</h2>
        <p className="ingest-lede">{copy.lede}</p>

        {languageToggle}

        <button type="button" onClick={() => setStarted(true)} className="ingest-start">
          <span>{copy.start}</span>
          <CategoryIcon name="ArrowRight" size={16} />
        </button>
      </section>
    );
  }

  /**
   * Finishing the steps is not the same as it working, and this screen used to
   * say "Quedó andando" on the strength of eight taps. It had no way of knowing:
   * a mistyped token or the wrong sender number ends here too, and the user
   * would only find out weeks later by noticing an empty ledger. Now the claim
   * waits for the first real message, and the page says plainly that it is
   * still waiting.
   */
  if (done) {
    return (
      <section className="ingest ingest--done">
        <span className="ingest-trophy ingest-trophy--waiting" aria-hidden="true">
          <CategoryIcon name="Clock" size={28} />
        </span>
        <h2 className="ingest-hook">{copy.waitingHook}</h2>
        <p className="ingest-lede">{copy.waitingLede}</p>
        <button type="button" onClick={restart} className="ingest-restart">
          {copy.restart}
        </button>
      </section>
    );
  }

  const step = steps[index]!;
  const secret = step.copy === 'url' ? endpoint : `Bearer ${token}`;
  const previousCheer = index > 0 ? steps[index - 1]!.cheer : '';

  return (
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

        {previousCheer && <span className="ingest-cheer">{previousCheer}</span>}
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

      <div className={`ingest-step${exiting ? ' ingest-step--out' : ''}`} key={step.id}>
        <span className="ingest-eyebrow">{step.eyebrow}</span>
        <h2 className="ingest-title">{step.title}</h2>
        <p className="ingest-body">{step.body}</p>

        {step.copy && (
          <button
            type="button"
            onClick={() => copyValue(secret)}
            className="ingest-secret"
          >
            <code>{secret}</code>
            <span className="ingest-secret-action">
              {copied ? copy.copyDone : copy.copyIdle}
            </span>
          </button>
        )}

        {step.copy === 'token' && (
          <p className="ingest-warning">{copy.tokenWarning}</p>
        )}

        <button type="button" onClick={advance} className="ingest-start">
          <span>{step.cta}</span>
          <CategoryIcon name="ArrowRight" size={16} />
        </button>

        {/* Also here, not only on the first screen: which language the phone
            speaks is something the reader discovers at step two, when the menu
            they were told to tap is named something else. */}
        {languageToggle}
      </div>
    </section>
  );
}
