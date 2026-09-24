'use client';

import React, { useEffect, useRef, useState } from 'react';

import { CategoryIcon } from '@/components/ui/category-icon';
import { Money } from '@/components/ui/money';

/**
 * «Un martes cualquiera»: un día real recorriendo el sistema, de lado.
 *
 * Una sola línea y los momentos colgados de ella en zigzag: uno arriba, el
 * siguiente abajo, intercalados para que mientras lees uno ya asome el
 * otro. Cada momento dice qué hiciste, qué hizo Reasonny y lo que te costó,
 * con el fragmento real (el recibo, la pregunta del bot, la regla, la
 * escalera del día) dibujado en línea fina.
 *
 * Todo lo que se afirma aquí existe en el repositorio, salvo lo marcado «En
 * camino» (P3: se cita o no se dice):
 *  - captura por Atajo y guardado antes de clasificar → quick-add, regla 7;
 *  - pregunta con teclado y respuesta que se vuelve regla → chat-capture /
 *    categorization.service, commit f3f93d8;
 *  - «12000 taxi» y «si no lo entiende no lo guarda» → core/quick-entry.ts;
 *  - /hoy con las cifras de la app y agrupado en tu zona → commit 93625eb;
 *  - «Guardado» y «Lo recordaré para la próxima.» son los textos de i18n.ts;
 *  - el extracto NO está construido y lo dice.
 */

const CATEGORY_CHOICES = ['Restaurante', 'Café', 'Mercado', 'Transporte'] as const;

/* Los ocho pasos de la comparación «Hasta hoy», tres gastos: el cierre los
   compara con lo que costó el martes con Reasonny. */
const MANUAL_STEPS_PER_EXPENSE = 8;
const EXPENSES_IN_THE_DAY = 3;

/* La curva de /hoy: lo acumulado del día, paso a paso. Son los tres gastos
   del martes (18.500 + 42.500 + 12.000), así que la gráfica y el texto no
   pueden contradecirse. En pesos enteros: solo dibujan, no se suman. */
const DAY_TOTAL_PESOS = 73000;
const DAY_STEPS: ReadonlyArray<{ readonly minute: number; readonly total: number }> = [
  { minute: 9 * 60 + 41, total: 18500 },
  { minute: 13 * 60 + 5, total: 61000 },
  { minute: 19 * 60 + 30, total: 73000 },
];

/* ── La pista ────────────────────────────────────────────────────────────
 * Convierte el scroll vertical en avance horizontal (landing.css → "UN
 * MARTES — la línea en zigzag").
 *
 * El movimiento es CONTINUO y proporcional al dedo: un intento anterior se
 * detenía en cada momento, y un scroll que avanza sin que nada se mueva se
 * siente como un tirón, no como una pausa. Solo hay dos reposos cortos: al
 * fijarse (para ver la portada) y al final (para leer el cierre quieto).
 *
 * Coste por cuadro, que es lo que la hacía trabarse:
 *  - una sola lectura de geometría (el pin) y cero lecturas después de
 *    escribir, así que no hay layout forzado;
 *  - se escribe solo lo que cambió: un momento fuera de su tramo de
 *    revelado no se toca (antes se reescribían los siete cada cuadro);
 *  - la línea tiene su propio elemento: una variable en la lista obligaba a
 *    recalcular los estilos de todo lo que cuelga de ella.
 * Todo lo que se escribe es transform u opacity: compositor, fuera del INP.
 */

interface Pace {
  /** px de scroll por px de avance. >1 = la pista va más despacio que el dedo. */
  readonly ratio: number;
  /** Reposos al fijarse y al final, en fracciones del alto de pantalla. */
  readonly holdStart: number;
  readonly holdEnd: number;
  /** Un momento empieza a armarse con su borde izquierdo en `from` y queda
   *  entero en `to` (fracciones del ancho de pantalla). */
  readonly from: number;
  readonly to: number;
}

/* Mobile first: en el teléfono cabe un momento por pantalla y el siguiente
   asoma del otro lado de la línea. El que asoma está cortado por el borde,
   así que se queda tenue y solo termina de armarse cuando ya cabe entero
   (su borde izquierdo cerca del margen). Armarlo antes dejaba un texto
   brillante partido a media palabra. En desktop caben tres: se termina de
   armar antes de pasar por el centro. */
function paceFor(vw: number): Pace {
  return vw > 900
    ? { ratio: 1.1, holdStart: 0.12, holdEnd: 0.4, from: 0.98, to: 0.55 }
    : { ratio: 1.2, holdStart: 0.1, holdEnd: 0.45, from: 0.95, to: 0.08 };
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function useJourneyTrack(pinRef: React.RefObject<HTMLDivElement | null>): void {
  useEffect(() => {
    const pin = pinRef.current;
    if (!pin) return;
    const stage = pin.querySelector<HTMLElement>('.landing-journey-stage');
    const track = pin.querySelector<HTMLElement>('.landing-journey-track');
    const intro = pin.querySelector<HTMLElement>('.landing-journey-intro');
    const list = pin.querySelector<HTMLElement>('.landing-journey');
    const fill = pin.querySelector<HTMLElement>('.landing-journey-line-fill');
    const steps = Array.from(pin.querySelectorAll<HTMLElement>('.landing-journey-moment'));
    if (!stage || !track || !list || steps.length < 2) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let active = false;
    // Medido una vez por layout, nunca por cuadro.
    let distance = 0;
    let startPx = 0;
    let ratio = 1;
    let total = 0;
    let lefts: number[] = [];
    let starts: number[] = [];
    let span = 1;
    let nodes: number[] = [];
    let arrivals: number[] = [];
    // Lo último escrito, para no reescribir lo que no cambió.
    let lastX = -1;
    let lastT: string[] = [];
    let lastFill = '';
    let lastIntro = '';

    function render(): void {
      frame = 0;
      if (!active) return;
      const sc = -pin!.getBoundingClientRect().top;
      const x = Math.round(Math.min(distance, Math.max(0, (sc - startPx) / ratio)));
      if (x === lastX) return;
      lastX = x;
      track!.style.transform = `translate3d(${-x}px, 0, 0)`;

      for (let i = 0; i < steps.length; i++) {
        const t = clamp01((starts[i]! - (lefts[i]! - x)) / span).toFixed(2);
        if (t !== lastT[i]) {
          steps[i]!.style.setProperty('--t', t);
          lastT[i] = t;
        }
      }

      // La punta del trazo llega a cada nodo justo cuando su momento empieza
      // a armarse, y entre dos llegadas avanza en línea recta.
      let pos = nodes[0]!;
      for (let i = 0; i < steps.length; i++) {
        if (x < arrivals[i]!) break;
        const next = arrivals[i + 1];
        if (next === undefined) {
          pos = nodes[i]!;
          break;
        }
        if (x < next) {
          pos = nodes[i]! + (nodes[i + 1]! - nodes[i]!) * ((x - arrivals[i]!) / (next - arrivals[i]!));
          break;
        }
      }
      const f = clamp01((pos - nodes[0]!) / (nodes[nodes.length - 1]! - nodes[0]!)).toFixed(3);
      if (fill && f !== lastFill) {
        fill.style.transform = `scaleX(${f})`;
        lastFill = f;
      }

      const io = (1 - clamp01(x / (window.innerWidth * 0.6)) * 0.7).toFixed(2);
      if (intro && io !== lastIntro) {
        intro.style.opacity = io;
        lastIntro = io;
      }
    }

    function schedule(): void {
      if (!frame) frame = requestAnimationFrame(render);
    }

    function reset(): void {
      active = false;
      pin!.classList.remove('is-track');
      pin!.style.removeProperty('--journey-height');
      track!.style.transform = '';
      if (fill) fill.style.transform = '';
      if (intro) intro.style.opacity = '';
      steps.forEach((el) => el.style.removeProperty('--t'));
      lastX = -1;
      lastT = [];
      lastFill = '';
      lastIntro = '';
    }

    function evaluate(): void {
      reset();
      if (reduceMotion.matches) return;
      pin!.classList.add('is-track');

      // Cada momento vive en media altura (arriba o abajo de la línea): su
      // cuerpo tiene que caber ahí, o se lee recortado dentro del tramo fijo.
      const fits = steps.every((el) => {
        const body = el.querySelector<HTMLElement>('.landing-journey-body');
        const node = el.querySelector<HTMLElement>('.landing-journey-node');
        if (!body || !node) return true;
        return body.offsetHeight <= (el.clientHeight - node.offsetHeight) / 2 + 1;
      });
      if (!fits) {
        reset();
        return;
      }

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const pace = paceFor(vw);
      distance = Math.max(0, track!.scrollWidth - stage!.clientWidth);
      ratio = pace.ratio;
      startPx = vh * pace.holdStart;
      total = startPx + distance * ratio + vh * pace.holdEnd;

      lefts = steps.map((el) => el.getBoundingClientRect().left);
      span = vw * (pace.from - pace.to);
      // Entero en `to` o, si la pista se acaba antes de llevarlo hasta ahí
      // (los últimos en desktop), en donde se queda quieto.
      starts = lefts.map((l) => Math.max(vw * pace.to, l - distance) + span);
      arrivals = lefts.map((l, i) => l - starts[i]!);
      const listLeft = list!.getBoundingClientRect().left;
      const dot = steps[0]!.querySelector<HTMLElement>('.landing-journey-dot')?.offsetWidth ?? 0;
      nodes = lefts.map((l) => l - listLeft + dot / 2);

      pin!.style.setProperty('--journey-height', `${Math.round(total + stage!.clientHeight)}px`);
      active = true;
      render();
    }

    // En iOS la barra de la URL al esconderse dispara `resize` con solo el
    // alto cambiado. Rearmar ahí haría saltar la pista a mitad del scroll:
    // solo un cambio de ancho (girar el teléfono) vuelve a medir.
    let lastWidth = window.innerWidth;
    function onResize(): void {
      if (window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      evaluate();
    }

    evaluate();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', onResize);
    reduceMotion.addEventListener('change', evaluate);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', onResize);
      reduceMotion.removeEventListener('change', evaluate);
      reset();
    };
  }, [pinRef]);
}

/* ── Piezas ─────────────────────────────────────────────────────────── */

interface MomentProps {
  readonly id?: string;
  readonly side: 'up' | 'down';
  readonly hour: string;
  readonly cost: string;
  readonly soon?: boolean;
  readonly title: React.ReactNode;
  readonly text?: React.ReactNode;
  readonly artifact: React.ReactNode;
}

function Moment({ id, side, hour, cost, soon, title, text, artifact }: MomentProps): React.ReactElement {
  const classes = ['landing-journey-moment', `landing-journey-moment--${side}`];
  if (soon) classes.push('landing-journey-moment--soon');
  return (
    <li id={id} className={classes.join(' ')}>
      <div className="landing-journey-body">
        {/* Un solo bloque que se anima: tres piezas sueltas eran tres
            capas que el navegador recalculaba por cuadro. */}
        <div className="landing-journey-copy">
          <p className="landing-journey-when">
            <span className="landing-journey-hour">{hour}</span>
            <span className="landing-journey-cost">{cost}</span>
          </p>
          <h4 className="landing-journey-title">{title}</h4>
          {text ? <p className="landing-journey-text">{text}</p> : null}
        </div>
        <div className="landing-journey-artifact">{artifact}</div>
      </div>

      <div className="landing-journey-node" aria-hidden="true">
        <span className="landing-journey-dot" />
      </div>
    </li>
  );
}

function BotBubble({ children }: { readonly children: React.ReactNode }): React.ReactElement {
  return <div className="landing-journey-bubble">{children}</div>;
}

function UserBubble({ children }: { readonly children: React.ReactNode }): React.ReactElement {
  return <div className="landing-journey-bubble landing-journey-bubble--you">{children}</div>;
}

function iconFor(category: string): string {
  switch (category) {
    case 'Café':
      return 'Coffee';
    case 'Mercado':
      return 'ShoppingCart';
    case 'Transporte':
      return 'Car';
    default:
      return 'Utensils';
  }
}

/* 13:06 — las reglas, como etiquetas colgadas de su categoría, escalonadas.
   La de arriba es la que acabas de enseñarle. */
function RulesArt({ choice }: { readonly choice: string }): React.ReactElement {
  const rows: ReadonlyArray<{ merchant: string; icon: string; fresh?: boolean }> = [
    { merchant: 'La Puerta Falsa', icon: iconFor(choice), fresh: true },
    { merchant: 'Juan Valdez', icon: 'Coffee' },
    { merchant: 'Uber', icon: 'Car' },
  ];
  return (
    <ul className="landing-journey-rules" aria-label="Reglas aprendidas">
      {rows.map((r) => (
        <li key={r.merchant} className={`landing-journey-rule${r.fresh ? ' landing-journey-rule--fresh' : ''}`}>
          <span className="landing-journey-rule-tag">{r.merchant}</span>
          <span className="landing-journey-rule-icon">
            <CategoryIcon name={r.icon} size={15} />
          </span>
          {r.fresh ? <span className="landing-journey-rule-new">nueva</span> : null}
        </li>
      ))}
    </ul>
  );
}

/* 22:10 — lo acumulado del día como escalera: un peldaño por gasto. */
function TodayArt(): React.ReactElement {
  const W = 300;
  const H = 80;
  const x = (minute: number): number => (minute / (24 * 60)) * W;
  const y = (total: number): number => H - 4 - (total / DAY_TOTAL_PESOS) * (H - 14);
  let d = `M 0 ${H - 4}`;
  for (const s of DAY_STEPS) d += ` H ${x(s.minute).toFixed(1)} V ${y(s.total).toFixed(1)}`;
  d += ` H ${x(22 * 60 + 10).toFixed(1)}`;
  const area = `${d} V ${H} H 0 Z`;
  return (
    <div className="landing-journey-today">
      <div className="landing-journey-today-head">
        <span className="landing-journey-today-cmd">
          <CategoryIcon name="Clock" size={12} /> Hoy · 3 movimientos
        </span>
        <span className="landing-journey-today-figure">
          <Money amountMinor={BigInt(DAY_TOTAL_PESOS) * 100n} currency="COP" />
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="landing-journey-svg landing-journey-today-chart" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="jr-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className="landing-journey-stop-rose-soft" />
            <stop offset="1" className="landing-journey-stop-clear" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#jr-area)" />
        <path d={d} className="landing-journey-step" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="landing-journey-today-axis" aria-hidden="true">
        <span>0 h</span>
        <span>12 h</span>
        <span>24 h</span>
      </div>
    </div>
  );
}

/* Fin de mes — el extracto como hoja: lo que ya estaba se marca, lo que se
   escapó se enciende. La línea ámbar es la lectura que todavía no existe. */
function StatementArt(): React.ReactElement {
  const rows: ReadonlyArray<'ok' | 'new'> = ['ok', 'new', 'ok', 'new'];
  return (
    <div className="landing-journey-sheet" aria-hidden="true">
      <span className="landing-journey-sheet-scan" />
      {rows.map((state, i) => (
        <span key={i} className={`landing-journey-sheet-row landing-journey-sheet-row--${state}`}>
          <span className="landing-journey-sheet-bar" style={{ width: `${40 + ((i * 17) % 32)}%` }} />
          <span className="landing-journey-sheet-mark" />
        </span>
      ))}
      <span className="landing-journey-sheet-tag">Retiro en cajero · recuperada</span>
    </div>
  );
}

export function LandingDayJourney(): React.ReactElement {
  const pinRef = useRef<HTMLDivElement>(null);
  useJourneyTrack(pinRef);

  // La categoría que eliges a las 13:05 es la que aparece aprendida a las
  // 13:06: el ejemplo se comporta como el bot.
  const [choice, setChoice] = useState<string>('Restaurante');

  return (
    <div ref={pinRef} className="landing-journey-pin">
      <div className="landing-journey-stage">
        <div className="landing-journey-track">
          <div className="landing-journey-intro">
            <div className="landing-journey-intro-top">
              <h3 className="landing-journey-intro-title">
                Un martes cualquiera, <span className="landing-headline-gold">de principio a fin.</span>
              </h3>
            </div>
            <div className="landing-journey-intro-node" aria-hidden="true">
              <span className="landing-journey-intro-hint">
                Sigue bajando <span className="landing-journey-intro-arrow">→</span>
              </span>
            </div>
            <p className="landing-journey-intro-text">
              Tres gastos, una pregunta y una consulta. Junto a cada hora, lo que te costó.
            </p>
          </div>

          <ol id="features-telemetry" className="landing-journey">
            <li className="landing-journey-line" aria-hidden="true">
              <span className="landing-journey-line-fill" />
            </li>
            <Moment
              id="features-zero-touch"
              side="up"
              hour="9:41"
              cost="0 toques"
              title="Pagas el café con Apple Pay y sigues caminando."
              text={
                <>
                  El Atajo lee la alerta del banco y lo guarda <strong>antes</strong> de clasificarlo: perder
                  un gasto es peor que tenerlo sin etiqueta.
                </>
              }
              artifact={
                <div className="landing-journey-receipt">
                  <span className="landing-journey-receipt-nfc" aria-hidden="true">
                    <CategoryIcon name="Nfc" size={16} />
                  </span>
                  <div className="landing-journey-receipt-body">
                    <div className="landing-journey-receipt-row">
                      <span className="landing-journey-receipt-merchant">Starbucks Reserva</span>
                      <span className="landing-journey-receipt-amount">
                        <Money amountMinor={1850000n} currency="COP" />
                      </span>
                    </div>
                    <span className="landing-journey-ok">
                      <CategoryIcon name="Check" size={12} />
                      Cafetería, por una regla que ya conocía
                    </span>
                  </div>
                </div>
              }
            />

            <Moment
              id="features-telegram"
              side="down"
              hour="13:05"
              cost="te pregunta"
              title="Un sitio nuevo: no adivina, te pregunta por Telegram."
              artifact={
                <BotBubble>
                  <p className="landing-journey-bubble-text">
                    <strong><Money amountMinor={4250000n} currency="COP" /></strong> en La Puerta Falsa. ¿En qué
                    categoría va?
                  </p>
                  <div className="landing-journey-keys">
                    {CATEGORY_CHOICES.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setChoice(cat)}
                        aria-pressed={choice === cat}
                        className={`landing-journey-key${choice === cat ? ' landing-journey-key--on' : ''}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </BotBubble>
              }
            />

            <Moment
              side="up"
              hour="13:06"
              cost="2 toques"
              title={<>Tocas «{choice}» y queda como regla.</>}
              text="La próxima compra ahí entra sola, por el Atajo o por el chat."
              artifact={<RulesArt choice={choice} />}
            />

            <Moment
              side="down"
              hour="19:30"
              cost="1 mensaje"
              title="Pagas el taxi en efectivo y escribes «12000 taxi»."
              text="Ni el efectivo, ni Nequi, ni los QR mandan alerta: una línea de chat los cubre."
              artifact={
                <div className="landing-journey-chat">
                  <UserBubble>12000 taxi</UserBubble>
                  <BotBubble>
                    <p className="landing-journey-bubble-text">
                      <span className="landing-journey-ok">
                        <CategoryIcon name="Check" size={12} /> Guardado · Transporte
                      </span>
                      <Money amountMinor={1200000n} currency="COP" /> · ya conocía «taxi»
                    </p>
                  </BotBubble>
                </div>
              }
            />

            <Moment
              side="up"
              hour="22:10"
              cost="1 consulta"
              title="Antes de dormir, escribes /hoy."
              text="Las mismas cifras que la app, sumadas en tu zona horaria."
              artifact={<TodayArt />}
            />

            <Moment
              id="features-vision"
              side="down"
              hour="Fin de mes"
              cost="En camino"
              soon
              title="El extracto recupera lo que se escapó."
              text={
                <>
                  <strong>Todavía no está construido</strong>: hoy ese hueco lo cubre el chat.
                </>
              }
              artifact={<StatementArt />}
            />

            <li className="landing-journey-moment landing-journey-moment--up landing-journey-moment--end">
              <div className="landing-journey-body">
                <div className="landing-journey-copy">
                <p className="landing-journey-end-title">El martes, completo.</p>
                <dl className="landing-journey-tally">
                  <div className="landing-journey-tally-item">
                    <dt>gastos</dt>
                    <dd>{EXPENSES_IN_THE_DAY}</dd>
                  </div>
                  <div className="landing-journey-tally-item">
                    <dt>toques</dt>
                    <dd>2</dd>
                  </div>
                  <div className="landing-journey-tally-item">
                    <dt>mensaje</dt>
                    <dd>1</dd>
                  </div>
                  <div className="landing-journey-tally-item">
                    <dt>formularios</dt>
                    <dd>0</dd>
                  </div>
                </dl>
                <p className="landing-journey-end-note">
                  A mano habrían sido {EXPENSES_IN_THE_DAY * MANUAL_STEPS_PER_EXPENSE} pasos: los{' '}
                  {MANUAL_STEPS_PER_EXPENSE} de arriba, una vez por gasto.
                </p>
                </div>
              </div>

              <div className="landing-journey-node" aria-hidden="true">
                <span className="landing-journey-dot" />
              </div>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
