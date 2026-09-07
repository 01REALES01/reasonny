'use client';

import React, { useEffect, useState } from 'react';

import { CategoryIcon } from '@/components/ui/category-icon';

interface IngestSetupProps {
  readonly token: string;
  readonly endpoint: string;
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
const EXIT_MS = 200;

function buildSteps(): Step[] {
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
      id: 'filter',
      eyebrow: 'Paso 4',
      title: 'Escribe «Bancolombia»',
      body: (
        <>
          En el campo <em>Mensaje contiene</em>. Deja «Remitente» vacío. Marca{' '}
          <strong>Ejecutar inmediatamente</strong> y, si te deja, apaga{' '}
          <strong>Notificar al ejecutar</strong>.
        </>
      ),
      cta: 'Listo, siguiente',
      cheer: 'Con eso la captura es invisible.',
    },
    {
      id: 'action',
      eyebrow: 'Paso 5',
      title: 'Añade «Obtener contenido de la URL»',
      body: <>Búscala en las acciones y pega esta dirección:</>,
      copy: 'url',
      cta: 'URL pegada',
      cheer: 'Ya casi. Queda la parte técnica.',
    },
    {
      id: 'method',
      eyebrow: 'Paso 6',
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
      eyebrow: 'Paso 7',
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
export function IngestSetup({ token, endpoint }: IngestSetupProps): React.ReactElement {
  const steps = buildSteps();
  const [index, setIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Read after mount, never during render: the server has no localStorage, and
  // seeding state from it directly makes the first client render disagree with
  // the server's and React throws away the tree.
  useEffect(() => {
    try {
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

  function restart(): void {
    setIndex(0);
    setStarted(false);
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

  if (!started && index === 0) {
    return (
      <section className="ingest">
        <span className="ingest-badge">
          <CategoryIcon name="Nfc" size={13} />
          <span>Guardado automático</span>
        </span>

        <h2 className="ingest-hook">
          Que tus gastos se guarden <strong>solos</strong>.
        </h2>
        <p className="ingest-lede">
          Cuando te llegue el SMS del banco, la transacción entra sola. Son 8
          pasos cortos en tu iPhone y se hace una sola vez.
        </p>

        <button type="button" onClick={() => setStarted(true)} className="ingest-start">
          <span>Empezar</span>
          <CategoryIcon name="ArrowRight" size={16} />
        </button>
      </section>
    );
  }

  if (done) {
    return (
      <section className="ingest ingest--done">
        <span className="ingest-trophy" aria-hidden="true">
          <CategoryIcon name="ShieldCheck" size={28} />
        </span>
        <h2 className="ingest-hook">Quedó andando.</h2>
        <p className="ingest-lede">
          Haz una compra o una transferencia pequeña. En cuanto llegue el SMS,
          la vas a ver aparecer en <strong>Por revisar</strong> sin que hagas
          nada.
        </p>
        <button type="button" onClick={restart} className="ingest-restart">
          Volver a ver los pasos
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
        <span className="ingest-count">
          {index + 1} de {steps.length}
        </span>
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
              {copied ? 'Copiado' : 'Copiar'}
            </span>
          </button>
        )}

        {step.copy === 'token' && (
          <p className="ingest-warning">
            Esto escribe transacciones en tu cuenta. No lo pegues en un chat ni
            lo muestres en una captura.
          </p>
        )}

        <button type="button" onClick={advance} className="ingest-start">
          <span>{step.cta}</span>
          <CategoryIcon name="ArrowRight" size={16} />
        </button>
      </div>
    </section>
  );
}
