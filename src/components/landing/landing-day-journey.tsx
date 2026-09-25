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
 * La línea no se corta al final: cuando el martes termina, sigue de largo
 * más allá del último nodo (debajo de él se monta «Fin de mes», y bajar
 * ahí mismo tacharía su texto), gira en ángulo recto como los tallos,
 * baja hasta el borde de la pantalla fijada y, ya suelta la
 * sección, sigue en curva hasta el nodo sobre el titular de los bancos. Un
 * trazo que se interrumpe al cambiar de sección dice «esto se acabó»; uno
 * que continúa dice «esto sigue», que es lo que queremos que se sienta.
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
  /** Scroll que tarda la línea en bajar del último nodo al borde de la
   *  pantalla, en fracciones del alto. Va después del reposo final: primero
   *  se lee el cierre quieto, después la línea se va. */
  readonly drop: number;
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
    ? { ratio: 1.1, holdStart: 0.12, holdEnd: 0.18, drop: 0.36, from: 0.98, to: 0.55 }
    : { ratio: 1.2, holdStart: 0.1, holdEnd: 0.2, drop: 0.4, from: 0.95, to: 0.08 };
}

/* Ya suelta la sección, px de línea por px de scroll. Por debajo de 1 la
   punta sube despacio por la pantalla mientras la línea crece: se ve
   dibujarse. A 1 se quedaría clavada en el borde inferior y la línea
   parecería estática, entrando ya pintada. */
const THREAD_PACE = 0.5;
const THREAD_SAMPLES = 48;

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function useJourneyTrack(
  pinRef: React.RefObject<HTMLDivElement | null>,
  threadRef: React.RefObject<HTMLDivElement | null>,
): void {
  useEffect(() => {
    const pin = pinRef.current;
    const thread = threadRef.current;
    if (!pin || !thread) return;
    const stage = pin.querySelector<HTMLElement>('.landing-journey-stage');
    const track = pin.querySelector<HTMLElement>('.landing-journey-track');
    const intro = pin.querySelector<HTMLElement>('.landing-journey-intro');
    const list = pin.querySelector<HTMLElement>('.landing-journey');
    const fill = pin.querySelector<HTMLElement>('.landing-journey-line-fill');
    const steps = Array.from(pin.querySelectorAll<HTMLElement>('.landing-journey-moment'));
    const exit = pin.querySelector<HTMLElement>('.landing-journey-exit');
    const dropBox = pin.querySelector<HTMLElement>('.landing-journey-drop');
    const runLine = pin.querySelector<HTMLElement>('.landing-journey-run-line');
    const dropLine = pin.querySelector<HTMLElement>('.landing-journey-drop-line');
    const dropTip = pin.querySelector<HTMLElement>('.landing-journey-drop-tip');
    const reveal = thread.querySelector<HTMLElement>('.landing-journey-thread-reveal');
    const inner = thread.querySelector<HTMLElement>('.landing-journey-thread-inner');
    const threadTip = thread.querySelector<HTMLElement>('.landing-journey-thread-tip');
    const land = thread.querySelector<HTMLElement>('.landing-journey-thread-land');
    const paths = Array.from(thread.querySelectorAll<SVGPathElement>('path'));
    if (!stage || !track || !list || steps.length < 2) return;
    if (!exit || !dropBox || !runLine || !dropLine || !dropTip || !reveal || !inner || !threadTip || !land) return;

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
    // La salida: la bajada dentro de la pantalla fijada y la curva de fuera.
    let dropStart = 0;
    let dropSpan = 1;
    let runLen = 0;
    let dropLen = 0;
    let threadH = 0;
    let threadEnd = 0;
    let curveX: number[] = [];
    let curveY: number[] = [];
    // Lo último escrito, para no reescribir lo que no cambió.
    let lastX = -1;
    let lastT: string[] = [];
    let lastFill = '';
    let lastIntro = '';
    let lastExit = '';

    /** x de la curva a una altura dada. La curva baja siempre, así que la
     *  altura la identifica: basta interpolar entre las muestras. */
    function curveXAt(y: number): number {
      let lo = 0;
      let hi = curveY.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (curveY[mid]! <= y) lo = mid;
        else hi = mid;
      }
      const span = curveY[hi]! - curveY[lo]!;
      const k = span > 0 ? (y - curveY[lo]!) / span : 0;
      return curveX[lo]! + (curveX[hi]! - curveX[lo]!) * k;
    }

    function render(): void {
      frame = 0;
      if (!active) return;
      const sc = -pin!.getBoundingClientRect().top;
      renderTrack(sc);
      renderExit(sc);
    }

    function renderTrack(sc: number): void {
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

    /* La bajada llega al borde de la pantalla justo cuando la sección se
       suelta (`total`), y en ese mismo píxel empieza la curva: el borde
       inferior del escenario fijado ES el borde superior del hilo. Por eso
       no hace falta leer la posición del hilo: sale de la del pin. */
    function renderExit(sc: number): void {
      const d = clamp01((sc - dropStart) / dropSpan);
      const c = Math.round(Math.min(threadEnd, Math.max(0, (sc - total) * THREAD_PACE)));
      const key = `${d.toFixed(3)}|${c}`;
      if (key === lastExit) return;
      lastExit = key;

      // Velocidad constante a lo largo de la L: el tramo recto y la bajada
      // se reparten el recorrido según su largo.
      const along = d * (runLen + dropLen);
      const run = runLen > 0 ? clamp01(along / runLen) : 1;
      const fall = dropLen > 0 ? clamp01((along - runLen) / dropLen) : 1;
      runLine!.style.transform = `scaleX(${run.toFixed(3)})`;
      dropLine!.style.transform = `scaleY(${fall.toFixed(3)})`;
      dropTip!.style.transform = `translate3d(${Math.round(run * runLen)}px, ${Math.round(fall * dropLen)}px, 0)`;
      dropTip!.style.opacity = d > 0 && c === 0 ? '1' : '0';

      // Revelado con dos transforms opuestos en vez de stroke-dashoffset:
      // el marco baja hasta `c` y el dibujo sube lo mismo, así que se
      // queda quieto y solo cambia cuánto se ve. Todo en el compositor.
      reveal!.style.transform = `translate3d(0, ${c - threadH}px, 0)`;
      inner!.style.transform = `translate3d(0, ${threadH - c}px, 0)`;
      threadTip!.style.transform = `translate3d(${curveXAt(c).toFixed(1)}px, ${c}px, 0)`;
      threadTip!.style.opacity = c > 0 && c < threadEnd ? '1' : '0';
      thread!.classList.toggle('is-landed', c >= threadEnd);
    }

    function schedule(): void {
      if (!frame) frame = requestAnimationFrame(render);
    }

    function reset(): void {
      active = false;
      pin!.classList.remove('is-track');
      pin!.style.removeProperty('--journey-height');
      thread!.classList.remove('is-live', 'is-landed');
      track!.style.transform = '';
      if (fill) fill.style.transform = '';
      if (intro) intro.style.opacity = '';
      steps.forEach((el) => el.style.removeProperty('--t'));
      for (const el of [runLine, dropLine, dropTip, reveal, inner, threadTip]) {
        el!.style.transform = '';
        el!.style.opacity = '';
      }
      lastX = -1;
      lastT = [];
      lastFill = '';
      lastIntro = '';
      lastExit = '';
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

      thread!.classList.add('is-live');

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const pace = paceFor(vw);
      distance = Math.max(0, track!.scrollWidth - stage!.clientWidth);
      ratio = pace.ratio;
      startPx = vh * pace.holdStart;
      dropStart = startPx + distance * ratio + vh * pace.holdEnd;
      dropSpan = vh * pace.drop;
      total = dropStart + dropSpan;
      runLen = exit!.offsetWidth;
      dropLen = dropBox!.offsetHeight;

      lefts = steps.map((el) => el.getBoundingClientRect().left);
      span = vw * (pace.from - pace.to);
      // Entero en `to` o, si la pista se acaba antes de llevarlo hasta ahí
      // (los últimos en desktop), en donde se queda quieto.
      starts = lefts.map((l) => Math.max(vw * pace.to, l - distance) + span);
      arrivals = lefts.map((l, i) => l - starts[i]!);
      const listLeft = list!.getBoundingClientRect().left;
      const dot = steps[0]!.querySelector<HTMLElement>('.landing-journey-dot')?.offsetWidth ?? 0;
      nodes = lefts.map((l) => l - listLeft + dot / 2);

      // La curva sale de donde termina la bajada con la pista ya quieta y
      // aterriza en el punto que el CSS le da al nodo de llegada: el CSS
      // manda dónde, aquí solo se mide.
      const threadW = thread!.clientWidth;
      threadH = thread!.clientHeight;
      threadEnd = land!.offsetTop + land!.offsetHeight / 2;
      const endX = land!.offsetLeft + land!.offsetWidth / 2;
      const threadLeft = thread!.getBoundingClientRect().left;
      const startX = Math.min(threadW - 8, Math.max(8, lefts[lefts.length - 1]! - distance + exit!.offsetLeft + runLen - threadLeft));
      const c1 = threadEnd * 0.55;
      const c2 = threadEnd * 0.45;
      const d = `M ${startX.toFixed(1)} 0 C ${startX.toFixed(1)} ${c1.toFixed(1)} ${endX.toFixed(1)} ${c2.toFixed(1)} ${endX.toFixed(1)} ${threadEnd.toFixed(1)}`;
      paths.forEach((p) => p.setAttribute('d', d));
      curveX = [];
      curveY = [];
      for (let i = 0; i <= THREAD_SAMPLES; i++) {
        const t = i / THREAD_SAMPLES;
        const u = 1 - t;
        const a = u * u * u;
        const b = 3 * u * u * t;
        const e = 3 * u * t * t;
        const f = t * t * t;
        curveX.push((a + b) * startX + (e + f) * endX);
        curveY.push(b * c1 + e * c2 + f * threadEnd);
      }

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
  }, [pinRef, threadRef]);
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
  const threadRef = useRef<HTMLDivElement>(null);
  useJourneyTrack(pinRef, threadRef);

  // La categoría que eliges a las 13:05 es la que aparece aprendida a las
  // 13:06: el ejemplo se comporta como el bot.
  const [choice, setChoice] = useState<string>('Restaurante');

  return (
    <>
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

                {/* La salida: de largo, giro y bajada hasta el borde del escenario. */}
                <span className="landing-journey-exit" aria-hidden="true">
                  <span className="landing-journey-run">
                    <span className="landing-journey-run-line" />
                  </span>
                  <span className="landing-journey-drop">
                    <span className="landing-journey-drop-line" />
                  </span>
                  <span className="landing-journey-drop-tip" />
                </span>
              </li>
            </ol>
          </div>
        </div>
      </div>

      {/* El hilo hasta los bancos. Solo existe mientras la pista está activa:
          en la versión vertical no hay línea horizontal que continuar. La
          vía tenue va fuera del revelado para que se vea el camino antes que
          el trazo. Los `d` los escribe el hook, medidos. */}
      <div ref={threadRef} className="landing-journey-thread" aria-hidden="true">
        <svg className="landing-journey-thread-svg">
          <path className="landing-journey-thread-rail" />
        </svg>
        <div className="landing-journey-thread-reveal">
          <div className="landing-journey-thread-inner">
            <svg className="landing-journey-thread-svg">
              <path className="landing-journey-thread-glow" />
              <path className="landing-journey-thread-lit" />
            </svg>
          </div>
        </div>
        <span className="landing-journey-thread-tip" />
        <span className="landing-journey-thread-land" />
      </div>
    </>
  );
}
